$ErrorActionPreference = 'Stop'
if ([IO.Path]::DirectorySeparatorChar -ne '/') { throw 'Linux test only' }
$scripts = Split-Path -Parent $PSScriptRoot
function Import-TestFunction([string]$File, [string]$Name) {
    $tokens = $null; $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $scripts $File), [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw "Parse errors: $File" }
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $Name }, $true)
    if (-not $definition) { throw "Missing function: $Name" }
    return [scriptblock]::Create($definition.Extent.Text)
}
. (Import-TestFunction 'build-episode-segment-package.ps1' 'Test-PathInside')
if (-not (Test-PathInside '/tmp/CaseRoot/child' '/tmp/CaseRoot')) { throw 'Inside path rejected' }
foreach ($candidate in @('/tmp/caseroot/child', '/tmp/CaseRootSibling/child', '/tmp/CaseRoot/../other')) {
    if (Test-PathInside $candidate '/tmp/CaseRoot') { throw "Outside path accepted: $candidate" }
}
$resolvedRoot = '/tmp/CaseRoot'
$pathComparison = [StringComparison]::Ordinal
. (Import-TestFunction 'build-image-requirements-workbook.ps1' 'Resolve-ProjectPath')
if ((Resolve-ProjectPath 'child' 'test') -cne '/tmp/CaseRoot/child') { throw 'Relative path mismatch' }
foreach ($candidate in @('/tmp/caseroot/child', '../other', '/etc/passwd')) {
    $rejected = $false
    try { Resolve-ProjectPath $candidate 'test' | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw "Outside requirement path accepted: $candidate" }
}
'Linux case-sensitive path boundaries passed. Lexical check only, not an OS sandbox.'
