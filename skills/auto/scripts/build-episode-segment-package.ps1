[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
$supportedSchemaVersions = @('auto-episode-package/2.1', 'auto-episode-package/2.2', 'auto-episode-package/2.3')
$assetRootName = ([string][char]0x8d44 + [char]0x4ea7)
$sceneName = ([string][char]0x573a + [char]0x666f)
$propName = ([string][char]0x9053 + [char]0x5177)
$characterName = ([string][char]0x4eba + [char]0x7269)
$soundReferenceName = ([string][char]0x58f0 + [char]0x97f3 + [char]0x53c2 + [char]0x8003)
$mappingName = ([string][char]0x7d20 + [char]0x6750 + [char]0x6620 + [char]0x5c04)
$tailFrameName = ([string][char]0x5c3e + [char]0x5e27)
$assetWorkbookName = ([string][char]0x8d44 + [char]0x4ea7 + [char]0x603b + [char]0x8868 + '.xlsx')
$imageRequirementWorkbookName = ([string][char]0x751f + [char]0x56fe + [char]0x9700 + [char]0x6c42 + [char]0x5168 + [char]0x96c6 + '.xlsx')
$fixedAssetCategoryDirectories = @(
    "$assetRootName/$sceneName",
    "$assetRootName/$propName",
    "$assetRootName/$characterName",
    "$assetRootName/$soundReferenceName"
)
$fixedSegmentLayout = [ordered]@{
    promptFile = 'prompt.txt'
    scriptVerbatimFile = 'script-verbatim.txt'
    storyboardExecutionFile = 'storyboard-execution.txt'
    tscHandoffFile = 'tsc-handoff.yaml'
    mappingFile = "$mappingName.txt"
}

function Resolve-ConfiguredPath {
    param([string]$PathValue, [string]$ConfigDirectory)
    if ([IO.Path]::IsPathRooted($PathValue)) {
        return [IO.Path]::GetFullPath($PathValue)
    }
    return [IO.Path]::GetFullPath((Join-Path $ConfigDirectory $PathValue))
}

function Read-NormalizedText {
    param([string]$Path)
    return [IO.File]::ReadAllText($Path).TrimStart([char]0xFEFF).Replace("`r`n", "`n").Replace("`r", "`n").Trim()
}

function Assert-RelativePackagePath {
    param([string]$PathValue, [string]$Context)
    if ([string]::IsNullOrWhiteSpace($PathValue) -or $PathValue -eq '.') {
        throw ('{0} must be a non-empty relative package path: {1}' -f $Context, $PathValue)
    }
    if ([IO.Path]::IsPathRooted($PathValue) -or $PathValue -match '(^|[\\/])\.\.([\\/]|$)') {
        throw ('{0} must be a safe relative package path: {1}' -f $Context, $PathValue)
    }
}

function Assert-SingleDirectoryName {
    param([string]$PathValue, [string]$Context)
    Assert-RelativePackagePath -PathValue $PathValue -Context $Context
    if ($PathValue.IndexOfAny([char[]]@('/', '\')) -ge 0 -or [IO.Path]::GetFileName($PathValue) -ne $PathValue) {
        throw ('{0} must be one directory name, not a nested path: {1}' -f $Context, $PathValue)
    }
}

function Test-PathInside {
    param([string]$Candidate, [string]$Root)
    $rootWithSeparator = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $candidateFull = [IO.Path]::GetFullPath($Candidate)
    return $candidateFull.StartsWith($rootWithSeparator, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-SourceFile {
    param([string]$PathValue, [string]$ConfigDirectory, [string]$Context)
    $resolved = Resolve-ConfiguredPath -PathValue $PathValue -ConfigDirectory $ConfigDirectory
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        throw ('{0} not found: {1}' -f $Context, $resolved)
    }
    return $resolved
}

function Copy-VerifiedFile {
    param([string]$Source, [string]$Destination)
    $parent = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    if ((Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash) {
        throw "Copied file hash mismatch: $Destination"
    }
}

function Assert-OrderedLiteralCoverage {
    param([string]$Text, [string[]]$ExpectedLines, [string]$Context)
    $cursor = 0
    foreach ($line in $ExpectedLines) {
        $found = $Text.IndexOf($line, $cursor, [StringComparison]::Ordinal)
        if ($found -lt 0) {
            throw ('{0} does not cover source line in order: {1}' -f $Context, $line)
        }
        $cursor = $found + $line.Length
    }
}

function Get-OrderedShotIds {
    param([string]$Text)
    $ids = New-Object 'System.Collections.Generic.List[string]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
    foreach ($match in [regex]::Matches($Text, 'SHOT\d{3,}')) {
        if ($seen.Add($match.Value)) {
            $ids.Add($match.Value)
        }
    }
    return [string[]]$ids
}

function Assert-OrderedTokens {
    param([string]$Text, [string[]]$Tokens, [string]$Context)
    $cursor = 0
    foreach ($token in $Tokens) {
        $found = $Text.IndexOf($token, $cursor, [StringComparison]::Ordinal)
        if ($found -lt 0) {
            throw ('{0} does not contain {1} in storyboard order.' -f $Context, $token)
        }
        $cursor = $found + $token.Length
    }
}

function Assert-FixedPrompt {
    param(
        [string]$PromptText,
        [string]$Context,
        [double]$Duration,
        [string[]]$RequiredSections,
        [int]$TimedPhaseMinimum,
        [int]$TimedPhaseMaximum
    )
    $lines = $PromptText -split "`n"
    $expectedFirstLine = ([string][char]0x751f + [char]0x6210 + [char]0x65f6 + [char]0x957f + [char]0xff1a) + $Duration + ([char]0x79d2 + [char]0x3002)
    if ($lines[0].Trim() -ne $expectedFirstLine) {
        throw ('{0} must start with {1}.' -f $Context, $expectedFirstLine)
    }
    if ($PromptText -match '\{\{TailFrame\}\}|tail[-_ ]frame') {
        throw ('{0} contains deprecated video tail-frame continuity input.' -f $Context)
    }
    $lastIndex = -1
    foreach ($section in $RequiredSections) {
        $index = $PromptText.IndexOf($section, [StringComparison]::Ordinal)
        if ($index -lt 0 -or $index -le $lastIndex) {
            throw ('{0} must contain fixed section {1} in order.' -f $Context, $section)
        }
        $lastIndex = $index
    }
    $timedPattern = "\u3010([0-9]+(?:\.[0-9]+)?)\u2014([0-9]+(?:\.[0-9]+)?)\u79d2\u3011"
    $timed = @([regex]::Matches($PromptText, $timedPattern))
    if ($timed.Count -lt $TimedPhaseMinimum -or $timed.Count -gt $TimedPhaseMaximum) {
        throw ('{0} must contain {1}-{2} timed camera fields; found {3}.' -f $Context, $TimedPhaseMinimum, $TimedPhaseMaximum, $timed.Count)
    }
    $cursor = 0.0
    foreach ($match in $timed) {
        $start = [double]$match.Groups[1].Value
        $end = [double]$match.Groups[2].Value
        if ([math]::Abs($start - $cursor) -gt 0.01 -or $end -le $start) {
            throw ('{0} timed camera fields must be contiguous, non-overlapping and start at 0.0.' -f $Context)
        }
        $cursor = $end
    }
    if ([math]::Abs($cursor - $Duration) -gt 0.01) {
        throw ('{0} timed camera fields must end at {1} seconds; found {2}.' -f $Context, $Duration, $cursor)
    }
    if ($PromptText -match '\bC\d{3}\b|\bSHOT\d{3,}\b|秒｜镜头\d+|\bclipId\b') {
        throw ('{0} contains an internal planning identifier.' -f $Context)
    }
}

function Assert-PromptProductionContracts {
    param(
        [string]$PromptText,
        [string]$Context,
        [string]$VisualStyleSuffix,
        [string]$StateChangeContract,
        [string]$EndingPolicy
    )
    if ($StateChangeContract -eq 'explicit_pre_action_ordered_action_post_action') {
        $markerPrefixes = @(
            (([char]0x52a8) + ([char]0x4f5c) + ([char]0x524d) + ([char]0x72b6) + ([char]0x6001) + ([char]0xff1a)),
            (([char]0x52a8) + ([char]0x4f5c) + ([char]0x987a) + ([char]0x5e8f) + ([char]0xff1a)),
            (([char]0x52a8) + ([char]0x4f5c) + ([char]0x540e) + ([char]0x72b6) + ([char]0x6001) + ([char]0xff1a))
        )
        foreach ($marker in $markerPrefixes) {
            if ($PromptText.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
                throw "$Context must contain the state-change marker $marker."
            }
        }
    }
    if ($VisualStyleSuffix -and -not $PromptText.TrimEnd().EndsWith([string]$VisualStyleSuffix, [StringComparison]::Ordinal)) {
        throw "$Context must end with the configured visual style suffix."
    }
    if ([string]::IsNullOrWhiteSpace($EndingPolicy) -or ([regex]::Matches($PromptText, [regex]::Escape($EndingPolicy))).Count -ne 1) {
        throw "$Context must contain the configured ending policy exactly once."
    }
    if (-not $PromptText.TrimEnd().EndsWith(($EndingPolicy + "`n`n" + $VisualStyleSuffix), [StringComparison]::Ordinal)) {
        throw "$Context must place the configured ending policy immediately before the visual style suffix."
    }
}

function Resolve-ProductionProfile {
    param([pscustomobject]$Config)
    $noTailFramePolicy = ([string][char]0x4ec5 + [char]0x8bb0 + [char]0x5f55 + [char]0x6587 + [char]0x5b57 + [char]0x72b6 + [char]0x6001 + [char]0xff0c + [char]0x4e0d + [char]0x4e0a + [char]0x4f20 + [char]0x6216 + [char]0x5f15 + [char]0x7528 + [char]0x89c6 + [char]0x9891 + [char]0x5c3e + [char]0x5e27 + [char]0x3002)
    $noMusicPolicy = ([string][char]0x5168 + [char]0x7a0b + [char]0x65e0 + [char]0x80cc + [char]0x666f + [char]0x97f3 + [char]0x4e50 + [char]0x3002)
    if ($Config.schemaVersion -eq 'auto-episode-package/2.1') {
        return [pscustomobject]@{
            schemaVersion = 'auto-production-profile/legacy-2.1'
            profileId = 'legacy-2.1'
            contentCategory = 'scripted_narrative'
            genres = @('project_defined')
            visualMedium = 'project_defined'
            audience = 'project_defined'
            tone = @('project_defined')
            look = [pscustomobject]@{ styleSuffix = [string]$Config.visualStyleSuffix }
            prompt = [pscustomobject]@{
                language = 'zh-CN'
                timedPhaseMinimum = 4
                timedPhaseMaximum = 6
                stateChangeContract = [string]$Config.stateChangeContract
                continuityMode = 'written_ending_state_only'
                musicPolicy = 'none'
                endingPolicy = $noTailFramePolicy + $noMusicPolicy
            }
        }
    }
    $profile = $Config.productionProfile
    if (-not $profile -or $profile.schemaVersion -ne 'auto-production-profile/1.0') {
        throw 'Auto episode package 2.2+ requires productionProfile schema auto-production-profile/1.0.'
    }
    foreach ($field in @('profileId', 'contentCategory', 'visualMedium', 'audience')) {
        if ([string]::IsNullOrWhiteSpace([string]$profile.$field)) { throw "productionProfile.$field is required." }
        if ([string]$profile.$field -match '(?i:REQUIRED(?:_|$)|project[-_ ](?:defined|slug))') { throw "productionProfile.$field still contains a template placeholder." }
    }
    if (@($profile.genres).Count -eq 0 -or @($profile.tone).Count -eq 0) { throw 'productionProfile genres and tone must not be empty.' }
    foreach ($entry in @($profile.genres) + @($profile.tone)) {
        if ([string]::IsNullOrWhiteSpace([string]$entry) -or [string]$entry -match '(?i:REQUIRED(?:_|$)|project[-_ ](?:defined|slug))') { throw 'productionProfile genres and tone must replace every template placeholder.' }
    }
    if (-not $profile.look -or [string]::IsNullOrWhiteSpace([string]$profile.look.styleSuffix)) { throw 'productionProfile.look.styleSuffix is required.' }
    if ([string]$profile.look.styleSuffix -match '(?i:REQUIRED(?:_|$)|project[-_ ](?:defined|slug))') { throw 'productionProfile.look.styleSuffix still contains a template placeholder.' }
    if (-not $profile.prompt) { throw 'productionProfile.prompt is required.' }
    $phaseMinimum = [int]$profile.prompt.timedPhaseMinimum
    $phaseMaximum = [int]$profile.prompt.timedPhaseMaximum
    if ($phaseMinimum -lt 1 -or $phaseMaximum -gt 12 -or $phaseMaximum -lt $phaseMinimum) { throw 'productionProfile timed phase range must be from 1 to 12.' }
    if ($profile.prompt.language -ne 'zh-CN') { throw 'The current TSC compiler requires productionProfile.prompt.language zh-CN.' }
    if ($profile.prompt.continuityMode -ne 'written_ending_state_only') { throw 'Auto requires written_ending_state_only continuity.' }
    if ([string]::IsNullOrWhiteSpace([string]$profile.prompt.stateChangeContract) -or [string]::IsNullOrWhiteSpace([string]$profile.prompt.musicPolicy) -or [string]::IsNullOrWhiteSpace([string]$profile.prompt.endingPolicy)) { throw 'productionProfile prompt contracts are incomplete.' }
    if ([string]$profile.prompt.musicPolicy -match '(?i:REQUIRED(?:_|$))' -or [string]$profile.prompt.endingPolicy -match '(?i:REQUIRED(?:_|$))') { throw 'productionProfile sound and music policy still contains a template placeholder.' }
    if (-not ([string]$profile.prompt.endingPolicy).Contains($noTailFramePolicy)) { throw 'productionProfile endingPolicy must forbid video tail-frame continuity.' }
    if ($profile.prompt.musicPolicy -eq 'none' -and -not ([string]$profile.prompt.endingPolicy).Contains($noMusicPolicy)) { throw 'A none musicPolicy must explicitly forbid background music.' }
    return $profile
}

function Test-AssetDefinitions {
    param([pscustomobject]$Segment, [string]$PromptText)
    $expectedIndex = 1
    $destinations = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $allowedTypes = @('character', 'location', 'prop', 'character_voice', 'environment_audio', 'sound_effect')
    $requiredDestinationPrefixes = @{
        character = "$assetRootName/$characterName/"
        location = "$assetRootName/$sceneName/"
        prop = "$assetRootName/$propName/"
        character_voice = "$assetRootName/$soundReferenceName/"
        environment_audio = "$assetRootName/$soundReferenceName/"
        sound_effect = "$assetRootName/$soundReferenceName/"
    }
    foreach ($asset in @($Segment.assets)) {
        $expectedToken = '{{Mixed ' + $expectedIndex + '}}'
        if ($asset.mixedToken -ne $expectedToken) {
            throw ('Non-contiguous token in ' + $Segment.folder + '. Expected ' + $expectedToken + ', found ' + $asset.mixedToken + '.')
        }
        if (-not $asset.assetType -or $allowedTypes -notcontains $asset.assetType) {
            throw ('Invalid or missing assetType in ' + $Segment.folder + ': ' + $expectedToken)
        }
        if (-not $asset.role -or -not $asset.source -or -not $asset.destination) {
            throw ('Incomplete asset entry in ' + $Segment.folder + ': ' + $expectedToken)
        }
        if ($script:configSchemaVersion -in @('auto-episode-package/2.2', 'auto-episode-package/2.3') -and [string]::IsNullOrWhiteSpace([string]$asset.semanticClass)) {
            throw ('Auto 2.2+ assets require semanticClass in {0}: {1}' -f $Segment.folder, $expectedToken)
        }
        if ($script:packageMode -eq 'final_prevideo' -and ($asset.required -ne $true -or $asset.approvalStatus -ne 'approved' -or $asset.slotStatus -ne 'package_slot_verified')) {
            throw ('Final pre-video asset must be required, approved and package-slot verified in {0}: {1}' -f $Segment.folder, $expectedToken)
        }
        if ($asset.assetType -in @('character', 'character_voice') -and [string]::IsNullOrWhiteSpace([string]$asset.characterName)) {
            throw ('Character and character-voice assets require characterName in {0}: {1}' -f $Segment.folder, $expectedToken)
        }
        if ($asset.assetType -eq 'character' -and (-not $asset.promptAliases -or @($asset.promptAliases).Count -eq 0)) {
            throw ('Character assets require promptAliases in {0}: {1}' -f $Segment.folder, $expectedToken)
        }
        Assert-RelativePackagePath -PathValue $asset.destination -Context ('{0} asset destination' -f $Segment.folder)
        $normalizedDestination = ([string]$asset.destination).Replace('\', '/')
        if (-not $normalizedDestination.StartsWith($requiredDestinationPrefixes[$asset.assetType], [StringComparison]::Ordinal)) {
            throw ('Asset destination for {0} must be inside {1}: {2}' -f $asset.mixedToken, $requiredDestinationPrefixes[$asset.assetType], $asset.destination)
        }
        if (-not $destinations.Add([string]$asset.destination)) {
            throw ('Duplicate destination in ' + $Segment.folder + ': ' + $asset.destination)
        }
        $expectedIndex++
    }

    $referenced = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($match in [regex]::Matches($PromptText, '\{\{Mixed\s+(\d+)\}\}')) {
        [void]$referenced.Add([int]$match.Groups[1].Value)
    }
    for ($index = 1; $index -le @($Segment.assets).Count; $index++) {
        if (-not $referenced.Contains($index)) {
            throw ('Prompt for ' + $Segment.folder + ' does not reference {{Mixed ' + $index + '}}.')
        }
    }
    foreach ($index in $referenced) {
        if ($index -lt 1 -or $index -gt @($Segment.assets).Count) {
            throw ('Prompt for ' + $Segment.folder + ' references undefined token {{Mixed ' + $index + '}}.')
        }
    }
}

function Copy-PackageAsset {
    param(
        [pscustomobject]$Asset,
        [string]$DestinationRoot,
        [string]$ConfigDirectory,
        [System.Collections.Generic.List[string]]$MappingLines,
        [System.Collections.Generic.List[string]]$MissingLines
    )
    $source = Resolve-ConfiguredPath -PathValue $Asset.source -ConfigDirectory $ConfigDirectory
    $destination = Join-Path $DestinationRoot $Asset.destination
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        $MissingLines.Add($Asset.mixedToken + [char]9 + $Asset.role + [char]9 + $source)
        $MappingLines.Add($Asset.mixedToken + [char]9 + 'MISSING' + [char]9 + $Asset.assetType + [char]9 + $Asset.role + [char]9 + $Asset.destination)
        return
    }
    Copy-VerifiedFile -Source $source -Destination $destination
    $MappingLines.Add($Asset.mixedToken + [char]9 + 'OK' + [char]9 + $Asset.assetType + [char]9 + $Asset.role + [char]9 + $Asset.destination)
}

$resolvedConfig = [IO.Path]::GetFullPath($ConfigPath)
if (-not (Test-Path -LiteralPath $resolvedConfig -PathType Leaf)) {
    throw "Config file not found: $resolvedConfig"
}
$configDirectory = Split-Path -Parent $resolvedConfig
$config = [IO.File]::ReadAllText($resolvedConfig) | ConvertFrom-Json
if ($supportedSchemaVersions -notcontains $config.schemaVersion) {
    throw "Config schemaVersion must be auto-episode-package/2.1, 2.2 or 2.3. Found: $($config.schemaVersion)"
}
if (-not $config.outputRoot -or -not $config.episodeFolder -or -not $config.scriptSource -or -not $config.aspectRatio -or $null -eq $config.enableSound -or -not $config.segments -or -not $config.layout) {
    throw 'Config must define outputRoot, episodeFolder, scriptSource, aspectRatio, enableSound, layout and segments.'
}
$videoBackend = if ([string]::IsNullOrWhiteSpace([string]$config.videoBackend)) { 'libtv' } else { [string]$config.videoBackend }
if ($videoBackend -notin @('unselected', 'libtv', 'custom')) { throw 'videoBackend must be unselected, libtv or custom.' }
if ($videoBackend -eq 'libtv' -and (-not $config.targetModel -or -not $config.targetModelKey -or -not $config.modeType -or -not $config.resolution)) {
    throw 'LibTV packages must define targetModel, targetModelKey, modeType and resolution.'
}
if ($config.schemaVersion -in @('auto-episode-package/2.2', 'auto-episode-package/2.3') -and $videoBackend -eq 'libtv') {
    foreach ($field in @('targetModel', 'targetModelKey', 'modeType', 'aspectRatio', 'resolution')) {
        if ([string]$config.$field -match '(?i:REQUIRED(?:_|$))') { throw "Config $field still contains a template placeholder." }
    }
}
$packageMode = [string]$config.packageMode
if ($packageMode -notin @('draft_model_neutral', 'final_prevideo')) {
    throw 'packageMode must be draft_model_neutral or final_prevideo.'
}
Assert-SingleDirectoryName -PathValue ([string]$config.episodeFolder) -Context 'episodeFolder'
if ($config.schemaVersion -eq 'auto-episode-package/2.3' -and $packageMode -eq 'final_prevideo') {
    $episodeFolderPattern = '^' + [regex]::Escape([string][char]0x7b2c) + '[1-9]\d*' + [regex]::Escape([string][char]0x96c6) + '$'
    if ([string]$config.episodeFolder -notmatch $episodeFolderPattern) {
        throw 'Auto 2.3 final pre-video episodeFolder must use the canonical episode name: episode prefix + positive number + episode suffix.'
    }
}
if (-not [IO.Path]::IsPathRooted([string]$config.outputRoot)) {
    Assert-RelativePackagePath -PathValue ([string]$config.outputRoot) -Context 'outputRoot'
}
$outputRoot = Resolve-ConfiguredPath -PathValue $config.outputRoot -ConfigDirectory $configDirectory
$episodeRoot = [IO.Path]::GetFullPath((Join-Path $outputRoot $config.episodeFolder))
if (-not (Test-PathInside -Candidate $episodeRoot -Root $outputRoot)) {
    throw "episodeFolder escapes outputRoot: $episodeRoot"
}
$outputParent = Split-Path -Parent $outputRoot
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
    throw "Output parent does not exist: $outputParent"
}
$script:packageMode = $packageMode
$script:configSchemaVersion = [string]$config.schemaVersion
$script:videoBackend = $videoBackend
$productionProfile = Resolve-ProductionProfile -Config $config
$hasMinimumDuration = $null -ne $config.segmentDurationMinimumSeconds -and -not [string]::IsNullOrWhiteSpace([string]$config.segmentDurationMinimumSeconds)
$hasMaximumDuration = $null -ne $config.segmentDurationMaximumSeconds -and -not [string]::IsNullOrWhiteSpace([string]$config.segmentDurationMaximumSeconds)
if ($hasMinimumDuration -ne $hasMaximumDuration) {
    throw 'Config must define both segment duration bounds or leave both unbound.'
}
$hasDurationRange = $hasMinimumDuration -and $hasMaximumDuration
$minimumDuration = if ($hasDurationRange) { [double]$config.segmentDurationMinimumSeconds } else { 0 }
$maximumDuration = if ($hasDurationRange) { [double]$config.segmentDurationMaximumSeconds } else { 0 }
if ($hasDurationRange -and ($minimumDuration -le 0 -or $maximumDuration -lt $minimumDuration)) {
    throw 'Config segment duration bounds are invalid.'
}
if ($videoBackend -eq 'libtv' -and -not $hasDurationRange) {
    throw 'LibTV packages must define a valid segment duration minimum and maximum.'
}
$requiredLayoutFields = @(
    'promptFile', 'scriptSourceFile', 'scriptCoverageReportFile', 'scriptVerbatimFile',
    'storyboardExecutionFile', 'tscHandoffFile', 'mappingFile',
    'episodeSummaryFile', 'episodeMissingFile'
)
foreach ($field in $requiredLayoutFields) {
    if (-not $config.layout.$field) {
        throw "Config layout must define $field."
    }
    Assert-RelativePackagePath -PathValue $config.layout.$field -Context "layout.$field"
}
foreach ($field in @('promptDurationPrefix', 'promptDurationSuffix')) {
    if ([string]::IsNullOrWhiteSpace([string]$config.layout.$field)) {
        throw "Config layout must define $field."
    }
}
if (@($config.layout.promptFixedSections).Count -eq 0) {
    throw 'Config layout must define promptFixedSections.'
}
if ($config.schemaVersion -in @('auto-episode-package/2.2', 'auto-episode-package/2.3')) {
    if ([string]::IsNullOrWhiteSpace([string]$config.layout.productionProfileFile)) { throw 'Config layout must define productionProfileFile.' }
    Assert-RelativePackagePath -PathValue ([string]$config.layout.productionProfileFile) -Context 'layout.productionProfileFile'
}
if ([string]$config.layout.scriptSourceFile -cne 'script-source.txt' -or [string]$config.layout.scriptCoverageReportFile -cne 'script-coverage-report.md') {
    throw 'The fixed episode layout requires script-source.txt and script-coverage-report.md.'
}
foreach ($category in @($config.layout.assetCategoryDirectories)) {
    Assert-RelativePackagePath -PathValue $category -Context 'assetCategoryDirectories entry'
}
$configuredCategories = @($config.layout.assetCategoryDirectories | ForEach-Object { ([string]$_).Replace('\', '/') })
if ($configuredCategories.Count -ne $fixedAssetCategoryDirectories.Count) {
    throw 'assetCategoryDirectories does not match the fixed four-directory contract.'
}
foreach ($category in $fixedAssetCategoryDirectories) {
    if ($configuredCategories -cnotcontains $category) {
        throw 'assetCategoryDirectories does not match the fixed four-directory contract.'
    }
}
foreach ($entry in $fixedSegmentLayout.GetEnumerator()) {
    if ([string]$config.layout.($entry.Key) -cne [string]$entry.Value) {
        throw "layout.$($entry.Key) must be the fixed value $($entry.Value)."
    }
}

$scriptSourcePath = Assert-SourceFile -PathValue $config.scriptSource -ConfigDirectory $configDirectory -Context 'Script source'
if (([IO.Path]::GetFullPath($scriptSourcePath) -eq $episodeRoot) -or (Test-PathInside -Candidate $scriptSourcePath -Root $episodeRoot)) {
    throw 'Script source cannot be inside the episode output that -Force may replace.'
}
$scriptSourceText = Read-NormalizedText -Path $scriptSourcePath
$sourceLines = [string[]]($scriptSourceText -split "`n")
$episodeFiles = @()
$episodeDestinations = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$reservedEpisodeDestinations = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
if ($packageMode -eq 'final_prevideo') { [void]$reservedEpisodeDestinations.Add('content-review.json') }
foreach ($reserved in @($config.layout.scriptSourceFile, $config.layout.scriptCoverageReportFile, $config.layout.episodeSummaryFile, $config.layout.episodeMissingFile, $config.layout.episodeUniqueMissingFile)) {
    if (-not [string]::IsNullOrWhiteSpace([string]$reserved)) {
        if (-not $reservedEpisodeDestinations.Add(([string]$reserved).Replace('\', '/'))) {
            throw "Duplicate generated episode destination: $reserved"
        }
    }
}
if ($config.schemaVersion -in @('auto-episode-package/2.2', 'auto-episode-package/2.3')) {
    if (-not $reservedEpisodeDestinations.Add(([string]$config.layout.productionProfileFile).Replace('\', '/'))) {
        throw 'Duplicate generated production profile destination.'
    }
}
foreach ($file in @($config.episodeFiles)) {
    if (-not $file.source -or -not $file.destination) {
        throw 'Every episodeFiles entry must define source and destination.'
    }
    Assert-RelativePackagePath -PathValue $file.destination -Context 'episodeFiles destination'
    $normalizedDestination = ([string]$file.destination).Replace('\', '/')
    if ($reservedEpisodeDestinations.Contains($normalizedDestination) -or -not $episodeDestinations.Add($normalizedDestination)) {
        throw "episodeFiles destination collides with another package output: $($file.destination)"
    }
    $sourceFile = Assert-SourceFile -PathValue $file.source -ConfigDirectory $configDirectory -Context "Episode file $($file.destination)"
    if (([IO.Path]::GetFullPath($sourceFile) -eq $episodeRoot) -or (Test-PathInside -Candidate $sourceFile -Root $episodeRoot)) {
        throw "Episode source cannot be inside the output that -Force may replace: $sourceFile"
    }
    $episodeFiles += [pscustomobject]@{
        source = $sourceFile
        destination = [string]$file.destination
    }
}
if ($packageMode -eq 'final_prevideo') {
    $requiredFinalFiles = @('production-brief.md', 'asset-bible.yaml', $assetWorkbookName, 'asset-workbook-result.json', 'look-lock.md', 'reference-manifest.yaml', 'auto-state.json', 'image-delivery-manifest.json', 'sound-reference-manifest.yaml', 'release-report.md')
    if ($config.schemaVersion -eq 'auto-episode-package/2.3') {
        $requiredFinalFiles += @('project-inventory.json', 'script-preview.md', 'asset-requirements.json', $imageRequirementWorkbookName, 'asset-requirements-workbook-result.json', 'segment-progress.json')
    }
    foreach ($requiredFile in $requiredFinalFiles) {
        if (-not $episodeDestinations.Contains($requiredFile)) {
            throw "Final pre-video package must copy episode file: $requiredFile"
        }
    }
}

$segmentIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
$segmentFolders = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$validatedSegments = @()
$orderedPassages = @()
$totalSegmentDuration = 0
for ($segmentIndex = 0; $segmentIndex -lt @($config.segments).Count; $segmentIndex++) {
    $segment = @($config.segments)[$segmentIndex]
    if (-not $segment.id -or -not $segment.folder -or -not $segment.story -or -not $segment.promptSource -or -not $segment.scriptVerbatimSource -or -not $segment.storyboardExecutionSource -or -not $segment.tscHandoffSource -or -not $segment.promptStatus -or -not $segment.durationSeconds) {
        throw 'Every segment must define id, folder, story, durationSeconds, scriptVerbatimSource, storyboardExecutionSource, tscHandoffSource, promptSource and promptStatus.'
    }
    if (-not $segmentIds.Add([string]$segment.id)) {
        throw "Duplicate segment ID: $($segment.id)"
    }
    $expectedSegmentId = 'SEG{0:d3}' -f ($segmentIndex + 1)
    if ([string]$segment.id -cne $expectedSegmentId) {
        throw "Segments must be contiguous and ordered. Expected $expectedSegmentId, found $($segment.id)."
    }
    if ($config.schemaVersion -eq 'auto-episode-package/2.3' -and $packageMode -eq 'final_prevideo' -and [string]$segment.folder -cne [string]$segment.id) {
        throw "Auto 2.3 final pre-video segment folder must equal its segment ID: $($segment.id)."
    }
    if (-not $segmentFolders.Add([string]$segment.folder)) {
        throw "Duplicate segment folder: $($segment.folder)"
    }
    Assert-SingleDirectoryName -PathValue ([string]$segment.folder) -Context 'segment folder'
    if ($reservedEpisodeDestinations.Contains(([string]$segment.folder).Replace('\', '/')) -or $episodeDestinations.Contains(([string]$segment.folder).Replace('\', '/'))) {
        throw "Segment folder collides with an episode-level output: $($segment.folder)"
    }
    if ($null -eq $segment.sameSceneAsPrevious -or $segment.sameSceneAsPrevious -isnot [bool]) {
        throw "$($segment.id) must define boolean sameSceneAsPrevious."
    }
    if ($packageMode -eq 'final_prevideo' -and $segment.promptStatus -ne 'complete_local_prompt_video_generation_not_executed') {
        throw "$($segment.id) is not a final pre-video prompt."
    }
    $duration = [double]$segment.durationSeconds
    if ($duration -le 0) {
        throw "Segment $($segment.id) duration must be positive."
    }
    if ($hasDurationRange -and ($duration -lt $minimumDuration -or $duration -gt $maximumDuration)) {
        throw "Segment $($segment.id) duration $duration is outside $minimumDuration-$maximumDuration seconds."
    }
    $totalSegmentDuration += $duration

    $scriptVerbatimPath = Assert-SourceFile -PathValue $segment.scriptVerbatimSource -ConfigDirectory $configDirectory -Context "$($segment.id) verbatim script"
    $storyboardExecutionPath = Assert-SourceFile -PathValue $segment.storyboardExecutionSource -ConfigDirectory $configDirectory -Context "$($segment.id) storyboard execution"
    $tscHandoffPath = Assert-SourceFile -PathValue $segment.tscHandoffSource -ConfigDirectory $configDirectory -Context "$($segment.id) TSC handoff"
    $promptSourcePath = Assert-SourceFile -PathValue $segment.promptSource -ConfigDirectory $configDirectory -Context "$($segment.id) prompt"
    foreach ($sourceArtifact in @($scriptVerbatimPath, $storyboardExecutionPath, $tscHandoffPath, $promptSourcePath)) {
        if (([IO.Path]::GetFullPath($sourceArtifact) -eq $episodeRoot) -or (Test-PathInside -Candidate $sourceArtifact -Root $episodeRoot)) {
            throw "$($segment.id) source artifact cannot be inside the output that -Force may replace: $sourceArtifact"
        }
    }

    $scriptVerbatimText = Read-NormalizedText -Path $scriptVerbatimPath
    $storyboardExecutionText = Read-NormalizedText -Path $storyboardExecutionPath
    $tscHandoffText = Read-NormalizedText -Path $tscHandoffPath
    $promptText = Read-NormalizedText -Path $promptSourcePath
    $segmentLines = [string[]]($scriptVerbatimText -split "`n")
    Assert-OrderedLiteralCoverage -Text $storyboardExecutionText -ExpectedLines $segmentLines -Context "$($segment.id) storyboard execution"
    $shotIds = Get-OrderedShotIds -Text $storyboardExecutionText
    if ($shotIds.Count -eq 0) {
        throw "$($segment.id) storyboard execution has no SHOT IDs."
    }

    $durationLine = "$($config.layout.promptDurationPrefix)$duration$($config.layout.promptDurationSuffix)"
    $firstLine = ($promptText -split "`n", 2)[0].Trim()
    if ($firstLine -ne $durationLine) {
        throw "Prompt duration does not match segment duration for $($segment.folder). Expected: $durationLine"
    }
    if ($config.productionProfile.prompt.shotFormat -ne 'numbered_fields_v1') {
        Assert-FixedPrompt -PromptText $promptText -Context "$($segment.id) prompt" -Duration $duration -RequiredSections ([string[]]$config.layout.promptFixedSections) -TimedPhaseMinimum ([int]$productionProfile.prompt.timedPhaseMinimum) -TimedPhaseMaximum ([int]$productionProfile.prompt.timedPhaseMaximum)
        Assert-PromptProductionContracts -PromptText $promptText -Context "$($segment.id) prompt" -VisualStyleSuffix ([string]$productionProfile.look.styleSuffix) -StateChangeContract ([string]$productionProfile.prompt.stateChangeContract) -EndingPolicy ([string]$productionProfile.prompt.endingPolicy)
    }
    if ($videoBackend -eq 'libtv' -and $tscHandoffText.IndexOf([string]$config.targetModel, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "$($segment.id) TSC handoff does not name target model $($config.targetModel)."
    }
    if ($videoBackend -ne 'libtv' -and ($tscHandoffText -notmatch ('backend:\s*' + [regex]::Escape($videoBackend) + '(\s|$)') -or $tscHandoffText -notmatch 'capability_status:\s*(unbound|declared|verified)(\s|$)')) {
        throw "$($segment.id) TSC handoff does not record the $videoBackend backend state."
    }
    if ($tscHandoffText -notmatch "proposed_seconds:\s*$duration(\D|$)") {
        throw "$($segment.id) TSC handoff does not declare proposed_seconds: $duration."
    }
    if ($tscHandoffText -match "tail_frame|TailFrame|tail[-_ ]frame|$tailFrameName") {
        throw "$($segment.id) TSC handoff contains deprecated video tail-frame fields."
    }
    if ($tscHandoffText -notmatch 'continuity_mode:\s+written_ending_state_only') {
        throw "$($segment.id) TSC handoff must use written ending-state continuity."
    }
    if ($config.schemaVersion -in @('auto-episode-package/2.2', 'auto-episode-package/2.3')) {
        $profilePattern = 'profile_id:\s*' + [regex]::Escape([string]$productionProfile.profileId) + '(\s|$)'
        if ($tscHandoffText -notmatch $profilePattern -or $tscHandoffText -notmatch 'status:\s*locked(\s|$)') {
            throw "$($segment.id) TSC handoff must lock production profile $($productionProfile.profileId)."
        }
    }
    Test-AssetDefinitions -Segment $segment -PromptText $promptText

    $orderedPassages += $scriptVerbatimText
    $validatedSegments += [pscustomobject]@{
        definition = $segment
        sourceLineCount = $segmentLines.Count
        shotCount = $shotIds.Count
        scriptVerbatimPath = $scriptVerbatimPath
        storyboardExecutionPath = $storyboardExecutionPath
        tscHandoffPath = $tscHandoffPath
        promptSourcePath = $promptSourcePath
    }
}

if ($config.schemaVersion -eq 'auto-episode-package/2.3') {
    if ([int]$config.declaredSegmentCount -ne @($config.segments).Count) {
        throw "declaredSegmentCount $($config.declaredSegmentCount) does not match $(@($config.segments).Count) unique configured segments."
    }
    if ([double]$config.targetDurationSeconds -le 0 -or [math]::Abs($totalSegmentDuration - [double]$config.targetDurationSeconds) -gt 0.01) {
        throw "Segment durations total $totalSegmentDuration seconds but targetDurationSeconds is $($config.targetDurationSeconds)."
    }
}

$reconstructedSource = ($orderedPassages -join "`n")
if ($reconstructedSource -cne $scriptSourceText) {
    throw 'Ordered segment script passages do not reconstruct script-source.txt exactly.'
}

if ($config.productionProfile.prompt.shotFormat -eq 'numbered_fields_v1') {
    $validatorOutput = & node (Join-Path $PSScriptRoot 'validate-video-prompts.cjs') --project-root $configDirectory --config $resolvedConfig
    if ($LASTEXITCODE -ne 0) { throw "Numbered prompt validation failed; formal output was not replaced. $validatorOutput" }
    if ($validatorOutput) { [Console]::Error.WriteLine(($validatorOutput -join [Environment]::NewLine)) }
}
if ($packageMode -eq 'final_prevideo') {
    $validatorOutput = & node (Join-Path $PSScriptRoot 'validate-content-review.cjs') --project-root $configDirectory --config $resolvedConfig
    if ($LASTEXITCODE -ne 0) { throw "Content review failed; formal output was not replaced. $validatorOutput" }
    if ($validatorOutput) { [Console]::Error.WriteLine(($validatorOutput -join [Environment]::NewLine)) }
}

if (Test-Path -LiteralPath $episodeRoot) {
    if (-not $Force) {
        throw "Episode output already exists. Re-run with -Force to rebuild: $episodeRoot"
    }
}
$finalEpisodeRoot = $episodeRoot
if (-not (Test-Path -LiteralPath $outputRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
}
$stagingEpisodeRoot = Join-Path $outputRoot ('.auto-stage-{0}-{1}' -f $PID, [Guid]::NewGuid().ToString('N'))
$backupEpisodeRoot = Join-Path $outputRoot ('.auto-backup-{0}-{1}' -f $PID, [Guid]::NewGuid().ToString('N'))
$episodeRoot = $stagingEpisodeRoot
$stageCommitted = $false
$backupCreated = $false
try {
New-Item -ItemType Directory -Path $episodeRoot -Force | Out-Null
Copy-VerifiedFile -Source $scriptSourcePath -Destination (Join-Path $episodeRoot $config.layout.scriptSourceFile)
if ($packageMode -eq 'final_prevideo') {
    Copy-VerifiedFile -Source (Join-Path $configDirectory 'content-review.json') -Destination (Join-Path $episodeRoot 'content-review.json')
}
if ($config.schemaVersion -in @('auto-episode-package/2.2', 'auto-episode-package/2.3')) {
    $profileJson = $productionProfile | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText((Join-Path $episodeRoot $config.layout.productionProfileFile), $profileJson, $utf8Bom)
}
foreach ($file in $episodeFiles) {
    Copy-VerifiedFile -Source $file.source -Destination (Join-Path $episodeRoot $file.destination)
}

$episodeMissing = New-Object 'System.Collections.Generic.List[string]'
$episodeSummary = New-Object 'System.Collections.Generic.List[string]'
$episodeSummary.Add("$($config.layout.episodeLabel): $($config.episodeFolder)")
$episodeSummary.Add("Video backend: $videoBackend")
$episodeSummary.Add("Target model: $(if ($config.targetModel) { $config.targetModel } else { 'unbound' })")
$episodeSummary.Add("Production profile: $($productionProfile.profileId)")
$episodeSummary.Add("Duration range: $(if ($hasDurationRange) { "$minimumDuration-$maximumDuration seconds per segment" } else { 'unbound; story-derived durations' })")
$episodeSummary.Add("$($config.layout.segmentCountLabel): $(@($config.segments).Count)")
$episodeSummary.Add("Source lines: $($sourceLines.Count)")
$episodeSummary.Add('Script coverage: 100% exact reconstruction')
$episodeSummary.Add($config.layout.mappingNotice)
$episodeSummary.Add('')

$coverageLines = New-Object 'System.Collections.Generic.List[string]'
$coverageLines.Add('# Script Coverage Report')
$coverageLines.Add('')
$coverageLines.Add('- Policy: every in-scope source line is causal backbone')
$coverageLines.Add("- Video backend: $videoBackend")
$coverageLines.Add("- Target model: $(if ($config.targetModel) { $config.targetModel } else { 'unbound' })")
$coverageLines.Add("- Segment duration range: $(if ($hasDurationRange) { "$minimumDuration-$maximumDuration seconds" } else { 'unbound; story-derived durations' })")
$coverageLines.Add("- Source lines: $($sourceLines.Count)")
$coverageLines.Add('- Ordered segment reconstruction: PASS')
$coverageLines.Add('- Verbatim source coverage: 100%')
$coverageLines.Add('- Storyboard literal-source coverage: 100%')
$coverageLines.Add('- Missing or overlapping source text: 0')
$coverageLines.Add('- Status: PASS')
$coverageLines.Add('')
$coverageLines.Add('| Segment | Duration | Source lines | Storyboard shots | Status |')
$coverageLines.Add('|---|---:|---:|---:|---|')
foreach ($validated in $validatedSegments) {
    $segment = $validated.definition
    $coverageLines.Add("| $($segment.id) | $($segment.durationSeconds) | $($validated.sourceLineCount) | $($validated.shotCount) | PASS |")
}
[IO.File]::WriteAllLines((Join-Path $episodeRoot $config.layout.scriptCoverageReportFile), $coverageLines, $utf8Bom)

foreach ($validated in $validatedSegments) {
    $segment = $validated.definition
    $segmentRoot = Join-Path $episodeRoot $segment.folder
    foreach ($category in @($config.layout.assetCategoryDirectories)) {
        New-Item -ItemType Directory -Path (Join-Path $segmentRoot $category) -Force | Out-Null
    }
    $mappingLines = New-Object 'System.Collections.Generic.List[string]'
    $missingLines = New-Object 'System.Collections.Generic.List[string]'
    $mappingLines.Add("$($config.layout.segmentLabel): $($segment.folder)")
    $mappingLines.Add("$($config.layout.storyLabel): $($segment.story)")
    $mappingLines.Add("Video backend: $videoBackend")
    $mappingLines.Add("Target model: $(if ($config.targetModel) { $config.targetModel } else { 'unbound' })")
    $mappingLines.Add("$($config.layout.durationLabel): $($segment.durationSeconds)")
    $mappingLines.Add($config.layout.referenceNotice)
    $mappingLines.Add('')
    $mappingLines.Add($config.layout.mappingHeader)
    foreach ($asset in @($segment.assets)) {
        Copy-PackageAsset -Asset $asset -DestinationRoot $segmentRoot -ConfigDirectory $configDirectory -MappingLines $mappingLines -MissingLines $missingLines
    }
    Copy-VerifiedFile -Source $validated.promptSourcePath -Destination (Join-Path $segmentRoot $config.layout.promptFile)
    Copy-VerifiedFile -Source $validated.scriptVerbatimPath -Destination (Join-Path $segmentRoot $config.layout.scriptVerbatimFile)
    Copy-VerifiedFile -Source $validated.storyboardExecutionPath -Destination (Join-Path $segmentRoot $config.layout.storyboardExecutionFile)
    Copy-VerifiedFile -Source $validated.tscHandoffPath -Destination (Join-Path $segmentRoot $config.layout.tscHandoffFile)
    [IO.File]::WriteAllLines((Join-Path $segmentRoot $config.layout.mappingFile), $mappingLines, $utf8Bom)
    foreach ($line in $missingLines) {
        $episodeMissing.Add("$($segment.folder)`t$line")
    }
    $actualSegmentEntries = @((Get-ChildItem -LiteralPath $segmentRoot -Force).Name | Sort-Object)
    $expectedSegmentEntries = @(@($assetRootName, 'prompt.txt', 'script-verbatim.txt', 'storyboard-execution.txt', 'tsc-handoff.yaml', "$mappingName.txt") | Sort-Object)
    if (($actualSegmentEntries -join "`n") -cne ($expectedSegmentEntries -join "`n")) {
        throw "$($segment.folder) must contain exactly the six fixed delivery entries."
    }
    $assetRoot = Join-Path $segmentRoot $assetRootName
    $actualAssetDirectories = @((Get-ChildItem -LiteralPath $assetRoot -Force).Name | Sort-Object)
    $expectedAssetDirectories = @(@($sceneName, $propName, $characterName, $soundReferenceName) | Sort-Object)
    if (($actualAssetDirectories -join "`n") -cne ($expectedAssetDirectories -join "`n")) {
        throw "$($segment.folder) asset root does not match the fixed four-directory contract."
    }
    $episodeSummary.Add("$($segment.folder)`t$($segment.durationSeconds)`t$($validated.sourceLineCount)`t$(@($segment.assets).Count)`t$($missingLines.Count)`t$($segment.promptStatus)")
}

if ($episodeMissing.Count -gt 0) {
    [IO.File]::WriteAllLines((Join-Path $episodeRoot $config.layout.episodeMissingFile), $episodeMissing, $utf8Bom)
}
$missingRecords = @($episodeMissing | ForEach-Object {
    $parts = $_ -split "`t", 4
    [pscustomobject]@{
        segment = $parts[0]
        token = $parts[1]
        role = $parts[2]
        source = $parts[3]
    }
})
$uniqueMissingGroups = @($missingRecords | Group-Object source | Sort-Object Name)
$uniqueMissingFile = if ($config.layout.episodeUniqueMissingFile) { [string]$config.layout.episodeUniqueMissingFile } else { 'unique-missing-assets.txt' }
Assert-RelativePackagePath -PathValue $uniqueMissingFile -Context 'layout.episodeUniqueMissingFile'
$uniqueMissingOutput = New-Object 'System.Collections.Generic.List[string]'
$uniqueMissingOutput.Add("Missing reference uses: $($episodeMissing.Count)")
$uniqueMissingOutput.Add("Unique missing assets: $($uniqueMissingGroups.Count)")
$uniqueMissingOutput.Add('')
$uniqueMissingOutput.Add("Source`tRoles`tSegments")
foreach ($group in $uniqueMissingGroups) {
    $roles = @($group.Group.role | Sort-Object -Unique) -join ' | '
    $segments = @($group.Group.segment | Sort-Object -Unique) -join ' | '
    $uniqueMissingOutput.Add("$($group.Name)`t$roles`t$segments")
}
[IO.File]::WriteAllLines((Join-Path $episodeRoot $uniqueMissingFile), $uniqueMissingOutput, $utf8Bom)
$episodeSummary.Add("Missing reference uses: $($episodeMissing.Count)")
$episodeSummary.Add("Unique missing assets: $($uniqueMissingGroups.Count)")
[IO.File]::WriteAllLines((Join-Path $episodeRoot $config.layout.episodeSummaryFile), $episodeSummary, $utf8Bom)

if ($packageMode -eq 'final_prevideo' -and $episodeMissing.Count -gt 0) {
    throw "Final pre-video package has $($episodeMissing.Count) missing required asset reference(s)."
}
if (Test-Path -LiteralPath $finalEpisodeRoot) {
    Move-Item -LiteralPath $finalEpisodeRoot -Destination $backupEpisodeRoot
    $backupCreated = $true
}
try {
    Move-Item -LiteralPath $stagingEpisodeRoot -Destination $finalEpisodeRoot
    $stageCommitted = $true
    $episodeRoot = $finalEpisodeRoot
}
catch {
    if ($backupCreated -and -not (Test-Path -LiteralPath $finalEpisodeRoot)) {
        Move-Item -LiteralPath $backupEpisodeRoot -Destination $finalEpisodeRoot
        $backupCreated = $false
    }
    throw
}
if ($backupCreated) {
    Remove-Item -LiteralPath $backupEpisodeRoot -Recurse -Force
    $backupCreated = $false
}

[pscustomobject]@{
    outputRoot = $outputRoot
    episodeRoot = $episodeRoot
    targetModel = $config.targetModel
    videoBackend = $videoBackend
    productionProfile = $productionProfile.profileId
    segmentDurationRange = $(if ($hasDurationRange) { "$minimumDuration-$maximumDuration" } else { 'unbound' })
    segments = @($config.segments).Count
    sourceLines = $sourceLines.Count
    scriptCoveragePercent = 100
    missingAssets = $uniqueMissingGroups.Count
    missingAssetReferences = $episodeMissing.Count
    uniqueMissingReport = (Join-Path $episodeRoot $uniqueMissingFile)
    episodeFiles = $episodeFiles.Count
    packageMode = $packageMode
    validation = 'passed'
} | ConvertTo-Json -Compress
}
finally {
    if (-not $stageCommitted -and (Test-Path -LiteralPath $stagingEpisodeRoot)) {
        Remove-Item -LiteralPath $stagingEpisodeRoot -Recurse -Force
    }
    if ($backupCreated -and -not (Test-Path -LiteralPath $finalEpisodeRoot)) {
        Move-Item -LiteralPath $backupEpisodeRoot -Destination $finalEpisodeRoot
        $backupCreated = $false
    }
}
