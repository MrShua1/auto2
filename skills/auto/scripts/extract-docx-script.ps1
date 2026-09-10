[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [int]$StartLine = 1,

    [int]$EndLine = 0,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$utf8Bom = New-Object System.Text.UTF8Encoding($true)

$resolvedDocx = [IO.Path]::GetFullPath($DocxPath)
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
if (-not (Test-Path -LiteralPath $resolvedDocx -PathType Leaf)) {
    throw "DOCX file not found: $resolvedDocx"
}
if ([IO.Path]::GetExtension($resolvedDocx) -ne '.docx') {
    throw "Source must be a DOCX file: $resolvedDocx"
}
if ($StartLine -lt 1) {
    throw 'StartLine must be at least 1.'
}

$outputParent = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
    throw "Output parent does not exist: $outputParent"
}
if (-not (Test-Path -LiteralPath $resolvedOutput)) {
    New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
}

$sourceOutput = Join-Path $resolvedOutput 'script-source.txt'
if (-not $Force -and (Test-Path -LiteralPath $sourceOutput)) {
    throw "Script output already exists. Re-run with -Force: $sourceOutput"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedDocx)
try {
    $entry = $archive.GetEntry('word/document.xml')
    if ($null -eq $entry) {
        throw "word/document.xml is missing from: $resolvedDocx"
    }
    $stream = $entry.Open()
    try {
        $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::UTF8)
        try {
            $xmlText = $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}
finally {
    $archive.Dispose()
}

[xml]$xml = $xmlText
$namespace = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$namespace.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$paragraphs = @($xml.SelectNodes('//w:body//w:p[not(ancestor::w:txbxContent)]', $namespace))
$lines = New-Object 'System.Collections.Generic.List[string]'
foreach ($paragraph in $paragraphs) {
    $parts = New-Object 'System.Collections.Generic.List[string]'
    foreach ($node in $paragraph.SelectNodes('.//w:t|.//w:tab|.//w:br', $namespace)) {
        if ($node.LocalName -eq 't') {
            $parts.Add($node.InnerText)
        }
        elseif ($node.LocalName -eq 'tab') {
            $parts.Add("`t")
        }
        else {
            $parts.Add(' ')
        }
    }
    $text = ($parts -join '').Trim()
    if (-not [string]::IsNullOrWhiteSpace($text)) {
        $lines.Add($text)
    }
}

$effectiveEnd = if ($EndLine -gt 0) { $EndLine } else { $lines.Count }
if ($effectiveEnd -lt $StartLine -or $effectiveEnd -gt $lines.Count) {
    throw "Invalid non-empty line range $StartLine-$effectiveEnd; document has $($lines.Count) non-empty lines."
}

$selectedLines = New-Object 'System.Collections.Generic.List[string]'
for ($lineNumber = $StartLine; $lineNumber -le $effectiveEnd; $lineNumber++) {
    $selectedLines.Add($lines[$lineNumber - 1])
}
[IO.File]::WriteAllLines($sourceOutput, $selectedLines, $utf8Bom)

[pscustomobject]@{
    sourceOutput = $sourceOutput
    sourceSha256 = (Get-FileHash -LiteralPath $resolvedDocx -Algorithm SHA256).Hash
    nonEmptyLineRange = "$StartLine-$effectiveEnd"
    sourceLines = $selectedLines.Count
} | ConvertTo-Json -Compress
