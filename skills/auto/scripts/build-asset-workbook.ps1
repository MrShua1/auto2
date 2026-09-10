[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [string]$InputFile = 'asset-workbook-input.json',

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = [IO.Path]::GetFullPath($ProjectRoot)
$characterCategory = ([string][char]0x4eba + [char]0x7269)
$sceneCategory = ([string][char]0x573a + [char]0x666f)
$propCategory = ([string][char]0x9053 + [char]0x5177)
$indexSheetName = '_' + ([string][char]0x7d22 + [char]0x5f15)
$assetWorkbookFileName = ([string][char]0x8d44 + [char]0x4ea7 + [char]0x603b + [char]0x8868) + '.xlsx'
$assetNameHeader = ([string][char]0x8d44 + [char]0x4ea7 + [char]0x540d + [char]0x79f0)
$referenceImageHeader = ([string][char]0x53c2 + [char]0x8003 + [char]0x56fe)
if (-not (Test-Path -LiteralPath $resolvedRoot -PathType Container)) {
    throw "Project root not found: $resolvedRoot"
}

function Resolve-ProjectPath {
    param([string]$PathValue, [string]$Context)
    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        throw "$Context is required."
    }
    $resolved = if ([IO.Path]::IsPathRooted($PathValue)) {
        [IO.Path]::GetFullPath($PathValue)
    }
    else {
        [IO.Path]::GetFullPath((Join-Path $resolvedRoot $PathValue))
    }
    return $resolved
}

$inputPath = Resolve-ProjectPath -PathValue $InputFile -Context 'Workbook input path'
if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
    throw "Workbook input not found: $inputPath"
}
$inputData = [IO.File]::ReadAllText($inputPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
if ($inputData.schemaVersion -ne 'auto-asset-workbook-input/1.0') {
    throw "Unsupported workbook input schema: $($inputData.schemaVersion)"
}
$expectedSheets = @($characterCategory, $sceneCategory, $propCategory, $indexSheetName)
$actualSheets = @($inputData.sheetOrder | ForEach-Object { [string]$_ })
if (($actualSheets -join '|') -cne ($expectedSheets -join '|')) {
    throw 'sheetOrder must be exactly 人物, 场景, 道具, _索引.'
}
if ($inputData.approvalStatus -ne 'approved' -or [string]::IsNullOrWhiteSpace([string]$inputData.approvedAt)) {
    throw 'The workbook may contain only explicitly approved assets with an approval timestamp.'
}
if ($null -eq $inputData.assets) {
    throw 'Workbook input must define assets as an array; use an empty array when the approved project has no visual reference assets.'
}

$assetIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
$approvedSourcePaths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$allowedCategories = @($characterCategory, $sceneCategory, $propCategory)
$expectedImageCount = 0
foreach ($asset in @($inputData.assets)) {
    if (-not $asset.assetId -or -not $asset.name -or $allowedCategories -notcontains $asset.category) {
        throw 'Every workbook asset requires a unique assetId, name and legal category.'
    }
    if (-not $assetIds.Add([string]$asset.assetId)) {
        throw "Duplicate workbook assetId: $($asset.assetId)"
    }
    if (-not $asset.images) {
        throw "Approved workbook asset has no images: $($asset.assetId)"
    }
    foreach ($image in @($asset.images)) {
        if (-not $image.role -or -not $image.source -or [string]::IsNullOrWhiteSpace([string]$image.sha256)) {
            throw "Every approved workbook image requires role, source and sha256: $($asset.assetId)"
        }
        if ($image.approvalStatus -ne 'approved' -or [string]::IsNullOrWhiteSpace([string]$image.approvedAt)) {
            throw "Every workbook image requires its own explicit approval and timestamp: $($asset.assetId)"
        }
        if ([string]$image.approvedAt -ne [string]$inputData.approvedAt) {
            throw "Workbook image approval timestamp must match the aggregate review: $($asset.assetId)"
        }
        $sourcePath = Resolve-ProjectPath -PathValue ([string]$image.source) -Context "$($asset.assetId) image source"
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Approved source image not found: $sourcePath"
        }
        if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ine [string]$image.sha256) {
            throw "Approved source image hash changed after review: $sourcePath"
        }
        if (-not $approvedSourcePaths.Add($sourcePath)) {
            throw "Approved source image is listed more than once: $sourcePath"
        }
        $expectedImageCount++
    }
}

$outputFile = [string]$inputData.outputFile
if ($outputFile -cne $assetWorkbookFileName) {
    throw "outputFile must be the fixed project-root filename 资产总表.xlsx: $outputFile"
}
if ([IO.Path]::IsPathRooted($outputFile) -or $outputFile -match '(^|[\\/])\.\.([\\/]|$)' -or [IO.Path]::GetExtension($outputFile) -ne '.xlsx') {
    throw "outputFile must be a safe relative .xlsx path: $outputFile"
}
$outputPath = [IO.Path]::GetFullPath((Join-Path $resolvedRoot $outputFile))
$temporaryOutputPath = Join-Path $resolvedRoot ('.asset-workbook-{0}-{1}.xlsx' -f $PID, [Guid]::NewGuid().ToString('N'))
$resultPath = Join-Path $resolvedRoot 'asset-workbook-result.json'
$temporaryResultPath = Join-Path $resolvedRoot ('.asset-workbook-result-{0}-{1}.json' -f $PID, [Guid]::NewGuid().ToString('N'))
$outputBackupPath = Join-Path $resolvedRoot ('.asset-workbook-backup-{0}-{1}.xlsx' -f $PID, [Guid]::NewGuid().ToString('N'))
$resultBackupPath = Join-Path $resolvedRoot ('.asset-workbook-result-backup-{0}-{1}.json' -f $PID, [Guid]::NewGuid().ToString('N'))
if ((Test-Path -LiteralPath $outputPath) -and -not $Force) {
    throw "Workbook already exists. Re-run with -Force: $outputPath"
}

$excel = $null
& node (Join-Path $PSScriptRoot 'workbook-openxml.cjs') build $resolvedRoot $inputPath assets --force
if ($LASTEXITCODE -ne 0) { throw 'OpenXML asset workbook generation failed.' }
return
$workbook = $null
$validationWorkbook = $null
$embeddedCount = 0
$indexRow = 2
$outputBackedUp = $false
$resultBackedUp = $false

try {
    try {
        $excel = New-Object -ComObject Excel.Application
    }
    catch {
        throw "Microsoft Excel COM automation is unavailable; /分集 is BLOCKED at asset workbook generation. $($_.Exception.Message)"
    }
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Add()

    while ($workbook.Worksheets.Count -lt 4) {
        [void]$workbook.Worksheets.Add([Type]::Missing, $workbook.Worksheets.Item($workbook.Worksheets.Count))
    }
    while ($workbook.Worksheets.Count -gt 4) {
        $workbook.Worksheets.Item($workbook.Worksheets.Count).Delete()
    }
    for ($sheetIndex = 1; $sheetIndex -le 4; $sheetIndex++) {
        $workbook.Worksheets.Item($sheetIndex).Name = $expectedSheets[$sheetIndex - 1]
    }

    $indexSheet = $workbook.Worksheets.Item($indexSheetName)
    $headers = @('asset_id', 'category', 'asset_name', 'image_role', 'source_path', 'approval_status', 'approved_at', 'visible_sheet', 'visible_cell')
    for ($column = 1; $column -le $headers.Count; $column++) {
        $indexSheet.Cells.Item(1, $column).Value2 = $headers[$column - 1]
    }
    $indexSheet.Rows.Item(1).Font.Bold = $true

    foreach ($category in @($characterCategory, $sceneCategory, $propCategory)) {
        $sheet = $workbook.Worksheets.Item($category)
        $categoryAssets = @($inputData.assets | Where-Object { $_.category -eq $category })
        $maxImages = 1
        foreach ($asset in $categoryAssets) {
            $maxImages = [Math]::Max($maxImages, @($asset.images).Count)
        }
        $sheet.Cells.Item(1, 1).Value2 = $assetNameHeader
        $sheet.Columns.Item(1).ColumnWidth = 30
        for ($column = 1; $column -le $maxImages; $column++) {
            $sheet.Cells.Item(1, $column + 1).Value2 = "$referenceImageHeader $column"
            $sheet.Columns.Item($column + 1).ColumnWidth = 34
        }
        $sheet.Rows.Item(1).Font.Bold = $true
        $sheet.Rows.Item(1).RowHeight = 24

        $row = 2
        foreach ($asset in $categoryAssets) {
            $sheet.Cells.Item($row, 1).Value2 = [string]$asset.name
            $sheet.Rows.Item($row).RowHeight = 140
            $column = 2
            foreach ($image in @($asset.images)) {
                $sourcePath = Resolve-ProjectPath -PathValue ([string]$image.source) -Context "$($asset.assetId) image source"
                $cell = $sheet.Cells.Item($row, $column)
                $shape = $sheet.Shapes.AddPicture($sourcePath, $false, $true, 0, 0, -1, -1)
                $shape.LockAspectRatio = -1
                $scale = [Math]::Min(220.0 / [double]$shape.Width, 125.0 / [double]$shape.Height)
                $shape.Width = [double]$shape.Width * $scale
                $shape.Height = [double]$shape.Height * $scale
                $shape.Left = [double]$cell.Left + [Math]::Max(0, ([double]$cell.Width - [double]$shape.Width) / 2)
                $shape.Top = [double]$cell.Top + [Math]::Max(0, ([double]$cell.Height - [double]$shape.Height) / 2)
                $shape.AlternativeText = [string]$image.role

                $values = @(
                    [string]$asset.assetId,
                    [string]$asset.category,
                    [string]$asset.name,
                    [string]$image.role,
                    [IO.Path]::GetFullPath($sourcePath),
                    'approved',
                    [string]$image.approvedAt,
                    [string]$category,
                    $cell.Address($false, $false)
                )
                for ($indexColumn = 1; $indexColumn -le $values.Count; $indexColumn++) {
                    $indexSheet.Cells.Item($indexRow, $indexColumn).Value2 = $values[$indexColumn - 1]
                }
                $indexRow++
                $embeddedCount++
                $column++
            }
            $row++
        }
        $sheet.Activate()
        $excel.ActiveWindow.SplitColumn = 1
        $excel.ActiveWindow.FreezePanes = $true
    }

    $indexSheet.Columns.AutoFit() | Out-Null
    $indexSheet.Visible = 0
    $workbook.Worksheets.Item($characterCategory).Activate()
    $workbook.SaveAs($temporaryOutputPath, 51)
    $workbook.Close($true)
    [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    $workbook = $null

    $validationWorkbook = $excel.Workbooks.Open($temporaryOutputPath, 0, $true)
    $sheetNames = @()
    for ($sheetIndex = 1; $sheetIndex -le $validationWorkbook.Worksheets.Count; $sheetIndex++) {
        $sheetNames += [string]$validationWorkbook.Worksheets.Item($sheetIndex).Name
    }
    if (($sheetNames -join '|') -cne ($expectedSheets -join '|')) {
        throw "Workbook sheet order mismatch: $($sheetNames -join ', ')"
    }
    if ($validationWorkbook.Worksheets.Item($indexSheetName).Visible -ne 0) {
        throw 'Workbook index sheet is not hidden.'
    }
    $validatedShapes = 0
    foreach ($category in @($characterCategory, $sceneCategory, $propCategory)) {
        $validatedShapes += $validationWorkbook.Worksheets.Item($category).Shapes.Count
    }
    $validatedIndexRows = $validationWorkbook.Worksheets.Item($indexSheetName).UsedRange.Rows.Count - 1
    if ($embeddedCount -ne $expectedImageCount -or $validatedShapes -ne $expectedImageCount -or $validatedIndexRows -ne $expectedImageCount) {
        throw "Workbook image/index mismatch: $validatedShapes shapes, $validatedIndexRows index rows, $expectedImageCount expected."
    }
    $validationWorkbook.Close($false)
    [Runtime.InteropServices.Marshal]::ReleaseComObject($validationWorkbook) | Out-Null
    $validationWorkbook = $null

    $result = [ordered]@{
        schemaVersion = 'auto-asset-workbook-result/1.0'
        projectId = [string]$inputData.projectId
        path = $outputPath
        sheetNames = $sheetNames
        hiddenIndex = $true
        canonicalAssetCount = @($inputData.assets).Count
        embeddedImageCount = $embeddedCount
        indexRowCount = $validatedIndexRows
        approvalStatus = 'approved'
        approvedAt = [string]$inputData.approvedAt
        approvedSourcePaths = @($approvedSourcePaths | Sort-Object)
        generatedAt = [DateTime]::UtcNow.ToString('o')
        validation = 'passed'
    }
    [IO.File]::WriteAllText($temporaryResultPath, ($result | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))

    try {
        if (Test-Path -LiteralPath $outputPath) {
            Move-Item -LiteralPath $outputPath -Destination $outputBackupPath
            $outputBackedUp = $true
        }
        if (Test-Path -LiteralPath $resultPath) {
            Move-Item -LiteralPath $resultPath -Destination $resultBackupPath
            $resultBackedUp = $true
        }
        Move-Item -LiteralPath $temporaryOutputPath -Destination $outputPath
        Move-Item -LiteralPath $temporaryResultPath -Destination $resultPath
        if ($outputBackedUp) {
            Remove-Item -LiteralPath $outputBackupPath -Force
            $outputBackedUp = $false
        }
        if ($resultBackedUp) {
            Remove-Item -LiteralPath $resultBackupPath -Force
            $resultBackedUp = $false
        }
    }
    catch {
        if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
        if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath -Force }
        if ($outputBackedUp) {
            Move-Item -LiteralPath $outputBackupPath -Destination $outputPath
            $outputBackedUp = $false
        }
        if ($resultBackedUp) {
            Move-Item -LiteralPath $resultBackupPath -Destination $resultPath
            $resultBackedUp = $false
        }
        throw
    }
    $result | ConvertTo-Json -Compress
}
finally {
    if (Test-Path -LiteralPath $temporaryOutputPath) {
        Remove-Item -LiteralPath $temporaryOutputPath -Force
    }
    if (Test-Path -LiteralPath $temporaryResultPath) {
        Remove-Item -LiteralPath $temporaryResultPath -Force
    }
    if ($outputBackedUp -and -not (Test-Path -LiteralPath $outputPath)) {
        Move-Item -LiteralPath $outputBackupPath -Destination $outputPath
        $outputBackedUp = $false
    }
    if ($resultBackedUp -and -not (Test-Path -LiteralPath $resultPath)) {
        Move-Item -LiteralPath $resultBackupPath -Destination $resultPath
        $resultBackedUp = $false
    }
    if ($validationWorkbook -ne $null) {
        try { $validationWorkbook.Close($false) } catch {}
        [Runtime.InteropServices.Marshal]::ReleaseComObject($validationWorkbook) | Out-Null
    }
    if ($workbook -ne $null) {
        try { $workbook.Close($false) } catch {}
        [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    }
    if ($excel -ne $null) {
        try { $excel.Quit() } catch {}
        [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
