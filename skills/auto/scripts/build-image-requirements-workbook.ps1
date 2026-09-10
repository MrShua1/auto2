[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [string]$InputFile = 'asset-requirements.json',

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = [IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path -LiteralPath $resolvedRoot -PathType Container)) {
    throw "Project root not found: $resolvedRoot"
}

function Resolve-ProjectPath {
    param([string]$PathValue, [string]$Context)
    if ([string]::IsNullOrWhiteSpace($PathValue)) { throw "$Context is required." }
    $resolved = if ([IO.Path]::IsPathRooted($PathValue)) {
        [IO.Path]::GetFullPath($PathValue)
    }
    else {
        [IO.Path]::GetFullPath((Join-Path $resolvedRoot $PathValue))
    }
    $rootPrefix = $resolvedRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($resolved -ne $resolvedRoot -and -not $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Context must remain inside PROJECT_ROOT: $PathValue"
    }
    return $resolved
}

function Join-CellValues {
    param($Values)
    return (@($Values | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n")
}

function Convert-CodePoints {
    param([int[]]$CodePoints)
    return -join ($CodePoints | ForEach-Object { [char]$_ })
}

$inputPath = Resolve-ProjectPath -PathValue $InputFile -Context 'Asset requirement registry'
if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) { throw "Asset requirement registry not found: $inputPath" }
$data = [IO.File]::ReadAllText($inputPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
if ($data.schemaVersion -ne 'auto-asset-requirements/1.0') { throw "Unsupported asset requirement schema: $($data.schemaVersion)" }
if (-not $data.projectId -or -not $data.projectRoot -or -not $data.scriptSource -or -not $data.scriptSha256 -or $null -eq $data.rows) {
    throw 'Asset requirement registry must define projectId, projectRoot, scriptSource, scriptSha256 and rows.'
}
if ([IO.Path]::GetFullPath([string]$data.projectRoot) -ne $resolvedRoot) { throw 'Asset requirement registry PROJECT_ROOT does not match the command PROJECT_ROOT.' }
$scriptPath = Resolve-ProjectPath -PathValue ([string]$data.scriptSource) -Context 'Script source'
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) { throw "Script source not found: $scriptPath" }
if ((Get-FileHash -LiteralPath $scriptPath -Algorithm SHA256).Hash -ine [string]$data.scriptSha256) { throw 'Script source hash changed after the asset universe was built.' }

$allowedAssetTypes = @('character', 'location', 'prop')
$allowedStatuses = @('approved_existing', 'pending_human_review', 'missing', 'rejected_invalid', 'generated_pending_human_review', 'approved_generated')
$allowedGenerationStatuses = @('planned', 'generating', 'generated', 'failed', 'not_required', 'approved')
$validStatuses = @('approved_existing', 'approved_generated')
$versionIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
$allEpisodes = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
$computedIssues = New-Object 'System.Collections.Generic.List[string]'
$requiredRows = @($data.rows)
$generationRows = @()

foreach ($row in $requiredRows) {
    foreach ($field in @('assetType', 'semanticClass', 'entityId', 'name', 'versionId', 'validationStatus', 'generationStatus')) {
        if ([string]::IsNullOrWhiteSpace([string]$row.$field)) { throw "Asset requirement row is missing $field." }
    }
    if ($allowedAssetTypes -notcontains [string]$row.assetType) { throw "Invalid assetType for $($row.versionId): $($row.assetType)" }
    if (-not $versionIds.Add([string]$row.versionId)) { throw "Duplicate asset requirement versionId: $($row.versionId)" }
    if (@($row.episodes).Count -eq 0 -or @($row.scenes).Count -eq 0 -or @($row.scriptEvidence).Count -eq 0) {
        throw "$($row.versionId) requires episode, scene and exact script evidence."
    }
    foreach ($episode in @($row.episodes)) {
        if ([string]::IsNullOrWhiteSpace([string]$episode)) { throw "$($row.versionId) contains an empty episode ID." }
        [void]$allEpisodes.Add([string]$episode)
    }
    if ($allowedStatuses -notcontains [string]$row.validationStatus) { throw "Invalid validationStatus for $($row.versionId): $($row.validationStatus)" }
    if ($allowedGenerationStatuses -notcontains [string]$row.generationStatus) { throw "Invalid generationStatus for $($row.versionId): $($row.generationStatus)" }
    $requiresGeneration = $row.generationRequired -eq $true
    if ($requiresGeneration) {
        if ([string]::IsNullOrWhiteSpace([string]$row.generationPrompt)) { throw "$($row.versionId) requires a finalized generation prompt." }
        if ([string]$row.validationStatus -notin @('missing', 'rejected_invalid')) { throw "$($row.versionId) can require generation only when missing or rejected by the human reviewer." }
        $generationRows += $row
    }
    else {
        if ([string]$row.validationStatus -in @('missing', 'rejected_invalid')) { throw "$($row.versionId) still requires generation but generationRequired is false." }
        $expectedGenerationStatus = switch ([string]$row.validationStatus) {
            'approved_existing' { 'not_required' }
            'pending_human_review' { 'not_required' }
            'generated_pending_human_review' { 'generated' }
            'approved_generated' { 'approved' }
        }
        if ([string]$row.generationStatus -ne $expectedGenerationStatus) { throw "$($row.versionId) has an invalid non-generation status." }
    }
    if ([string]$row.validationStatus -in $validStatuses) {
        if (@($row.confirmationEvidence).Count -eq 0) { throw "$($row.versionId) cannot be approved without human confirmation evidence." }
        if ([string]::IsNullOrWhiteSpace([string]$row.finalPath) -or [string]::IsNullOrWhiteSpace([string]$row.finalSha256)) {
            throw "$($row.versionId) is valid but lacks finalPath or finalSha256."
        }
        $finalPath = Resolve-ProjectPath -PathValue ([string]$row.finalPath) -Context "$($row.versionId) final path"
        if (-not (Test-Path -LiteralPath $finalPath -PathType Leaf)) { throw "Valid asset file not found: $finalPath" }
        if ((Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash -ine [string]$row.finalSha256) { throw "Valid asset hash mismatch: $finalPath" }
    }
    if ([string]$row.validationStatus -eq 'generated_pending_human_review') {
        if ([string]::IsNullOrWhiteSpace([string]$row.finalPath)) {
            throw "$($row.versionId) is pending human review but lacks a completed generation record."
        }
        $generatedPath = Resolve-ProjectPath -PathValue ([string]$row.finalPath) -Context "$($row.versionId) generated path"
        if (-not (Test-Path -LiteralPath $generatedPath -PathType Leaf)) { throw "Generated asset file not found: $generatedPath" }
    }
    foreach ($issue in @($row.validationIssues)) {
        if (-not [string]::IsNullOrWhiteSpace([string]$issue)) { $computedIssues.Add("$($row.versionId): $issue") }
    }
    if ([string]$row.validationStatus -notin $validStatuses) { $computedIssues.Add("$($row.versionId): unresolved status $($row.validationStatus)") }
    if ([string]$row.generationStatus -eq 'failed') { $computedIssues.Add("$($row.versionId): image generation failed") }
}

$episodeCoverage = @()
foreach ($episode in @($allEpisodes | Sort-Object)) {
    $episodeRows = @($requiredRows | Where-Object { @($_.episodes) -contains $episode })
    $episodeValid = @($episodeRows | Where-Object { [string]$_.validationStatus -in $validStatuses }).Count
    $episodeMissing = @($episodeRows | Where-Object { [string]$_.validationStatus -eq 'missing' }).Count
    $episodeInvalid = @($episodeRows | Where-Object { [string]$_.validationStatus -eq 'rejected_invalid' }).Count
    $episodePending = @($episodeRows | Where-Object { [string]$_.validationStatus -in @('pending_human_review', 'generated_pending_human_review') }).Count
    $episodeCoverage += [pscustomobject]@{
        episodeId = $episode
        requiredVersions = $episodeRows.Count
        validVersions = $episodeValid
        missingVersions = $episodeMissing
        invalidVersions = $episodeInvalid
        pendingHumanReviewVersions = $episodePending
    }
}

$validExisting = @($requiredRows | Where-Object { $_.validationStatus -eq 'approved_existing' }).Count
$validGenerated = @($requiredRows | Where-Object { $_.validationStatus -eq 'approved_generated' }).Count
$missing = @($requiredRows | Where-Object { $_.validationStatus -eq 'missing' }).Count
$invalid = @($requiredRows | Where-Object { $_.validationStatus -eq 'rejected_invalid' }).Count
$pendingHumanReview = @($requiredRows | Where-Object { $_.validationStatus -in @('pending_human_review', 'generated_pending_human_review') }).Count
$status = if ($missing -eq 0 -and $invalid -eq 0 -and $pendingHumanReview -eq 0 -and ($validExisting + $validGenerated) -eq $requiredRows.Count -and @($episodeCoverage | Where-Object { $_.missingVersions -ne 0 -or $_.invalidVersions -ne 0 -or $_.pendingHumanReviewVersions -ne 0 }).Count -eq 0) { 'COMPLETE' } else { 'NEED_FIX' }
if ([string]$data.status -ne $status) { throw "Registry status must be $status from computed full-series and per-episode coverage; found $($data.status)." }
if ($status -eq 'NEED_FIX' -and $computedIssues.Count -eq 0 -and @($data.issues).Count -eq 0) { throw 'STATUS=NEED_FIX requires explicit issues.' }

$outputPath = Join-Path $resolvedRoot (([string][char]0x751f + [char]0x56fe + [char]0x9700 + [char]0x6c42 + [char]0x5168 + [char]0x96c6) + '.xlsx')
$resultPath = Join-Path $resolvedRoot 'asset-requirements-workbook-result.json'
if ((Test-Path -LiteralPath $outputPath) -and -not $Force) { throw "Workbook already exists. Re-run with -Force: $outputPath" }
$temporaryOutput = Join-Path $resolvedRoot ('.asset-requirements-{0}-{1}.xlsx' -f $PID, [Guid]::NewGuid().ToString('N'))
$temporaryResult = Join-Path $resolvedRoot ('.asset-requirements-result-{0}-{1}.json' -f $PID, [Guid]::NewGuid().ToString('N'))
$outputBackup = "$outputPath.bak-$PID"
$resultBackup = "$resultPath.bak-$PID"
$excel = $null
& node (Join-Path $PSScriptRoot 'workbook-openxml.cjs') build $resolvedRoot $inputPath requirements --force
if ($LASTEXITCODE -ne 0) { throw 'OpenXML requirement workbook generation failed.' }
return
$workbook = $null
$validationWorkbook = $null
$backedUpOutput = $false
$backedUpResult = $false

try {
    try { $excel = New-Object -ComObject Excel.Application }
    catch { throw "Microsoft Excel COM automation is unavailable; Auto is BLOCKED at image-requirement workbook generation. $($_.Exception.Message)" }
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Add()
    while ($workbook.Worksheets.Count -lt 3) { [void]$workbook.Worksheets.Add([Type]::Missing, $workbook.Worksheets.Item($workbook.Worksheets.Count)) }
    while ($workbook.Worksheets.Count -gt 3) { $workbook.Worksheets.Item($workbook.Worksheets.Count).Delete() }
    $sheetNames = @(
        ([string][char]0x751f + [char]0x56fe + [char]0x9700 + [char]0x6c42 + [char]0x5168 + [char]0x96c6),
        ([string][char]0x8986 + [char]0x76d6 + [char]0x7edf + [char]0x8ba1),
        ([string][char]0x95ee + [char]0x9898)
    )
    for ($index = 1; $index -le 3; $index++) { $workbook.Worksheets.Item($index).Name = $sheetNames[$index - 1] }

    $requirementsSheet = $workbook.Worksheets.Item($sheetNames[0])
    $headers = @(
        (Convert-CodePoints @(0x8d44,0x4ea7,0x7c7b,0x578b)), (Convert-CodePoints @(0x5b9e,0x4f53,0x49,0x44)),
        (Convert-CodePoints @(0x540d,0x79f0)), (Convert-CodePoints @(0x7248,0x672c,0x49,0x44)),
        (Convert-CodePoints @(0x4eba,0x7269,0x6e90,0x49,0x44)), (Convert-CodePoints @(0x670d,0x88c5,0x49,0x44)),
        (Convert-CodePoints @(0x4eba,0x7269,0x72b6,0x6001)), (Convert-CodePoints @(0x573a,0x666f,0x65f6,0x6bb5)),
        (Convert-CodePoints @(0x9053,0x5177,0x72b6,0x6001)), (Convert-CodePoints @(0x96c6,0x6570)),
        (Convert-CodePoints @(0x573a,0x6b21)), (Convert-CodePoints @(0x5267,0x672c,0x8bc1,0x636e)),
        (Convert-CodePoints @(0x5df2,0x6709,0x6587,0x4ef6)), (Convert-CodePoints @(0x6821,0x9a8c,0x72b6,0x6001)),
        (Convert-CodePoints @(0x751f,0x56fe,0x63d0,0x793a,0x8bcd)), (Convert-CodePoints @(0x751f,0x6210,0x72b6,0x6001)),
        (Convert-CodePoints @(0x6700,0x7ec8,0x8def,0x5f84))
    )
    for ($column = 1; $column -le $headers.Count; $column++) { $requirementsSheet.Cells.Item(1, $column).Value2 = $headers[$column - 1] }
    $requirementsSheet.Rows.Item(1).Font.Bold = $true
    $rowIndex = 2
    foreach ($row in $generationRows) {
        $values = @(
            [string]$row.assetType, [string]$row.entityId, [string]$row.name, [string]$row.versionId,
            [string]$row.characterSourceId, [string]$row.wardrobeId, [string]$row.characterState,
            [string]$row.sceneTime, [string]$row.propState, (Join-CellValues $row.episodes),
            (Join-CellValues $row.scenes), (Join-CellValues $row.scriptEvidence),
            (Join-CellValues $row.existingFiles), [string]$row.validationStatus,
            [string]$row.generationPrompt, [string]$row.generationStatus, [string]$row.finalPath
        )
        for ($column = 1; $column -le $values.Count; $column++) { $requirementsSheet.Cells.Item($rowIndex, $column).Value2 = $values[$column - 1] }
        $rowIndex++
    }
    $requirementsSheet.UsedRange.WrapText = $true
    $requirementsSheet.UsedRange.VerticalAlignment = -4160
    $requirementsSheet.Columns.Item(1).Resize([Type]::Missing, $headers.Count).ColumnWidth = 18
    $requirementsSheet.Columns.Item(12).ColumnWidth = 50
    $requirementsSheet.Columns.Item(15).ColumnWidth = 70
    $requirementsSheet.Columns.Item(17).ColumnWidth = 45
    $requirementsSheet.Activate()
    $excel.ActiveWindow.SplitRow = 1
    $excel.ActiveWindow.FreezePanes = $true

    $coverageSheet = $workbook.Worksheets.Item($sheetNames[1])
    $coverageHeaders = @(
        (Convert-CodePoints @(0x8303,0x56f4)), (Convert-CodePoints @(0x9700,0x6c42,0x7248,0x672c)),
        (Convert-CodePoints @(0x6709,0x6548,0x7248,0x672c)), (Convert-CodePoints @(0x7f3a,0x5931,0x7248,0x672c)),
        (Convert-CodePoints @(0x4eba,0x5de5,0x5224,0x5b9a,0x4e0d,0x5408,0x683c)),
        (Convert-CodePoints @(0x5f85,0x4eba,0x5de5,0x786e,0x8ba4)), (Convert-CodePoints @(0x72b6,0x6001))
    )
    for ($column = 1; $column -le $coverageHeaders.Count; $column++) { $coverageSheet.Cells.Item(1, $column).Value2 = $coverageHeaders[$column - 1] }
    $coverageSheet.Rows.Item(1).Font.Bold = $true
    $coverageSheet.Cells.Item(2, 1).Value2 = Convert-CodePoints @(0x5168,0x5267)
    $coverageSheet.Cells.Item(2, 2).Value2 = [double]$requiredRows.Count
    $coverageSheet.Cells.Item(2, 3).Value2 = [double]($validExisting + $validGenerated)
    $coverageSheet.Cells.Item(2, 4).Value2 = [double]$missing
    $coverageSheet.Cells.Item(2, 5).Value2 = [double]$invalid
    $coverageSheet.Cells.Item(2, 6).Value2 = [double]$pendingHumanReview
    $coverageSheet.Cells.Item(2, 7).Value2 = $status
    $coverageRow = 3
    foreach ($episode in $episodeCoverage) {
        $coverageSheet.Cells.Item($coverageRow, 1).Value2 = [string]$episode.episodeId
        $coverageSheet.Cells.Item($coverageRow, 2).Value2 = [double]$episode.requiredVersions
        $coverageSheet.Cells.Item($coverageRow, 3).Value2 = [double]$episode.validVersions
        $coverageSheet.Cells.Item($coverageRow, 4).Value2 = [double]$episode.missingVersions
        $coverageSheet.Cells.Item($coverageRow, 5).Value2 = [double]$episode.invalidVersions
        $coverageSheet.Cells.Item($coverageRow, 6).Value2 = [double]$episode.pendingHumanReviewVersions
        $coverageSheet.Cells.Item($coverageRow, 7).Value2 = if ($episode.missingVersions -eq 0 -and $episode.invalidVersions -eq 0 -and $episode.pendingHumanReviewVersions -eq 0) { 'COMPLETE' } else { 'NEED_FIX' }
        $coverageRow++
    }
    $coverageSheet.Columns.AutoFit() | Out-Null

    $issuesSheet = $workbook.Worksheets.Item($sheetNames[2])
    $issuesSheet.Cells.Item(1, 1).Value2 = Convert-CodePoints @(0x95ee,0x9898)
    $issuesSheet.Rows.Item(1).Font.Bold = $true
    $issueRows = @($computedIssues) + @($data.issues | ForEach-Object { [string]$_ })
    $issueRows = @($issueRows | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
    for ($index = 0; $index -lt $issueRows.Count; $index++) { $issuesSheet.Cells.Item($index + 2, 1).Value2 = $issueRows[$index] }
    $issuesSheet.Columns.Item(1).ColumnWidth = 100
    $issuesSheet.Columns.Item(1).WrapText = $true

    $workbook.SaveAs($temporaryOutput, 51)
    $workbook.Close($true)
    [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    $workbook = $null
    $validationWorkbook = $excel.Workbooks.Open($temporaryOutput, 0, $true)
    $validatedNames = @()
    for ($index = 1; $index -le $validationWorkbook.Worksheets.Count; $index++) { $validatedNames += [string]$validationWorkbook.Worksheets.Item($index).Name }
    if (($validatedNames -join '|') -cne ($sheetNames -join '|')) { throw 'Image-requirement workbook sheet validation failed.' }
    $validatedRequirementRows = [Math]::Max(0, $validationWorkbook.Worksheets.Item($sheetNames[0]).UsedRange.Rows.Count - 1)
    if ($validatedRequirementRows -ne $generationRows.Count) { throw 'Image-requirement workbook row count does not match generation-required versions.' }
    $validationWorkbook.Close($false)
    [Runtime.InteropServices.Marshal]::ReleaseComObject($validationWorkbook) | Out-Null
    $validationWorkbook = $null

    $result = [ordered]@{
        schemaVersion = 'auto-asset-requirements-workbook-result/1.0'
        projectId = [string]$data.projectId
        sourceRegistry = $inputPath
        sourceRegistrySha256 = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
        path = $outputPath
        requiredVersions = $requiredRows.Count
        generationRows = $generationRows.Count
        validExistingVersions = $validExisting
        validGeneratedVersions = $validGenerated
        missingVersions = $missing
        invalidVersions = $invalid
        pendingHumanReviewVersions = $pendingHumanReview
        episodeCoverage = $episodeCoverage
        issueCount = $issueRows.Count
        status = $status
        generatedAt = [DateTime]::UtcNow.ToString('o')
        validation = 'passed'
    }
    [IO.File]::WriteAllText($temporaryResult, ($result | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))

    try {
        if (Test-Path -LiteralPath $outputPath) { Move-Item -LiteralPath $outputPath -Destination $outputBackup; $backedUpOutput = $true }
        if (Test-Path -LiteralPath $resultPath) { Move-Item -LiteralPath $resultPath -Destination $resultBackup; $backedUpResult = $true }
        Move-Item -LiteralPath $temporaryOutput -Destination $outputPath
        Move-Item -LiteralPath $temporaryResult -Destination $resultPath
        if ($backedUpOutput) { Remove-Item -LiteralPath $outputBackup -Force; $backedUpOutput = $false }
        if ($backedUpResult) { Remove-Item -LiteralPath $resultBackup -Force; $backedUpResult = $false }
    }
    catch {
        if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
        if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath -Force }
        if ($backedUpOutput) { Move-Item -LiteralPath $outputBackup -Destination $outputPath; $backedUpOutput = $false }
        if ($backedUpResult) { Move-Item -LiteralPath $resultBackup -Destination $resultPath; $backedUpResult = $false }
        throw
    }
    $result | ConvertTo-Json -Compress
}
finally {
    if ($validationWorkbook) { try { $validationWorkbook.Close($false) } catch {}; try { [Runtime.InteropServices.Marshal]::ReleaseComObject($validationWorkbook) | Out-Null } catch {} }
    if ($workbook) { try { $workbook.Close($false) } catch {}; try { [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null } catch {} }
    if ($excel) { try { $excel.Quit() } catch {}; try { [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {} }
    if (Test-Path -LiteralPath $temporaryOutput) { Remove-Item -LiteralPath $temporaryOutput -Force }
    if (Test-Path -LiteralPath $temporaryResult) { Remove-Item -LiteralPath $temporaryResult -Force }
    if ($backedUpOutput -and -not (Test-Path -LiteralPath $outputPath)) { Move-Item -LiteralPath $outputBackup -Destination $outputPath }
    if ($backedUpResult -and -not (Test-Path -LiteralPath $resultPath)) { Move-Item -LiteralPath $resultBackup -Destination $resultPath }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
