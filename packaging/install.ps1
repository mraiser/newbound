<#
Newbound + newbound-agent installer for Windows: the PowerShell counterpart
of install.sh.

Installs the Newbound agentic harness (https://github.com/mraiser/newbound)
together with the newbound-agent app, building with the Cargo features you
choose (serde JSON support, Python runtime), and writes the agent's LLM
configuration so you are ready to chat with the LLM of your choice.

Usage (Windows PowerShell 5.1 or PowerShell 7):
  irm https://newbound.com/install.ps1 | iex
  & ([scriptblock]::Create((irm https://newbound.com/install.ps1))) -Llm OLLAMA -Model qwen3 -Yes
  powershell -ExecutionPolicy Bypass -File install.ps1 [options]

Options:
  -Dir DIR           Install directory (default: .\newbound)
  -Serde / -NoSerde  Enable / disable serde JSON support (skip the question)
  -Python / -NoPython
                     Enable / disable the Python runtime (skip the question)
  -InstallPrereqs    Install missing Git, MSVC Build Tools and Rust without asking
  -Llm PROVIDER      LLM provider: VLLM | OPENAI | ANTHROPIC | GEMINI | OLLAMA | NONE
  -OpenAIUrl URL     Custom OpenAI-compatible endpoint (implies -Llm OPENAI)
  -Model MODEL       Model name for the chosen provider
  -ApiKey KEY        API key for the chosen provider
  -NoApiKey          The endpoint is keyless (skip the key question)
  -Yes               Accept defaults for every unanswered question
  -NoColor           Disable colored output
  -Help              Show this help

The installer writes <dir>\runtime\agent\botd.properties from your answers
(readable only by you: it holds API keys); newbound reads it on boot. Re-run
the installer to change providers, or edit that file (restart for LLM=).

Environment overrides: NEWBOUND_DIR, NEWBOUND_REPO, NEWBOUND_AGENT_REPO

`irm | iex` runs this script inside your own PowerShell session, so it never
calls `exit` (that would close your window) and keeps its settings local to
its functions.
#>
param(
    [string]$Dir = '',
    [switch]$Serde, [switch]$NoSerde,
    [switch]$Python, [switch]$NoPython,
    [switch]$InstallPrereqs,
    [string]$Llm = '',
    [string]$OpenAIUrl = '',
    [string]$Model = '',
    [string]$ApiKey = '',
    [switch]$NoApiKey,
    [switch]$Yes,
    [switch]$NoColor,
    [switch]$Help
)

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
function NbSay([string]$mark, [string]$text, [string]$color) {
    if ($script:NbColor -and $color) { Write-Host $mark -ForegroundColor $color -NoNewline; Write-Host " $text" }
    else { Write-Host "$mark $text" }
}
function NbInfo([string]$t)    { NbSay '==>' $t 'Cyan' }
function NbOk([string]$t)      { NbSay ' +' $t 'Green' }
function NbWarn([string]$t)    { NbSay ' !' $t 'Yellow' }
function NbErr([string]$t)     { NbSay ' x' $t 'Red' }
function NbSection([string]$t) { Write-Host ''; if ($script:NbColor) { Write-Host $t -ForegroundColor White } else { Write-Host $t } }
function NbFail([string]$t)    { throw [System.Exception]::new($t) }

# ---------------------------------------------------------------------------
# Prompting. Without a console to ask (or with -Yes) the default is used,
# as install.sh does when there is no terminal.
# ---------------------------------------------------------------------------
function NbRead([string]$prompt, [switch]$Secret) {
    try {
        if ($Secret) {
            $s = Read-Host -Prompt $prompt -AsSecureString
            $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
            try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) }
            finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
        }
        return Read-Host -Prompt $prompt
    } catch { return $null }
}

function NbAskYesNo([string]$prompt, [string]$default) {
    $hint = if ($default -eq 'y') { '[Y/n]' } else { '[y/N]' }
    if ($script:NbYes) { return ($default -eq 'y') }
    while ($true) {
        $r = NbRead "? $prompt $hint"
        if ($null -eq $r) { NbWarn "No console available; using default for: $prompt"; return ($default -eq 'y') }
        if ($r -eq '') { $r = $default }
        switch ($r.ToLower()) { { $_ -in 'y', 'yes' } { return $true } { $_ -in 'n', 'no' } { return $false } }
        NbWarn 'Please answer y or n.'
    }
}

function NbAskString([string]$prompt, [string]$default = '', [switch]$Secret) {
    if ($script:NbYes) { return $default }
    $hint = if ($Secret) { '(input hidden)' } elseif ($default) { "[$default]" } else { '' }
    $r = NbRead "? $prompt $hint" -Secret:$Secret
    if ($null -eq $r) {
        if (-not $default) { NbWarn "No console available; leaving blank: $prompt" }
        return $default
    }
    if ($r -eq '') { return $default }
    return $r
}

function NbAskChoice([string]$prompt, [string]$default, [string[]]$opts) {
    if ($script:NbYes) { return $default }
    while ($true) {
        Write-Host "? $prompt"
        for ($i = 0; $i -lt $opts.Count; $i++) { Write-Host ("   {0}) {1}" -f ($i + 1), $opts[$i]) }
        $r = NbRead "Choose [$default]"
        if ($null -eq $r) { NbWarn "No console available; using default for: $prompt"; return $default }
        if ($r -eq '') { $r = $default }
        if ($r -match '^\d+$' -and [int]$r -ge 1 -and [int]$r -le $opts.Count) { return $opts[[int]$r - 1] }
        $u = $r.ToUpper()
        if ($opts -contains $u) { return $u }
        NbWarn ("Please pick one of: " + ($opts -join ' '))
    }
}

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
function NbHave([string]$name) {
    # Skip the Microsoft Store stubs in WindowsApps (python.exe, python3.exe):
    # they open the Store instead of running anything.
    $c = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notmatch '\\WindowsApps\\' } | Select-Object -First 1
    return $c
}

function NbRefreshPath {
    # Pick up what an installer just added, without opening a new window.
    $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $u = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($m, $u) | Where-Object { $_ }) -join ';'
    $cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    if ((Test-Path $cargoBin) -and ($env:Path -notlike "*$cargoBin*")) { $env:Path = "$cargoBin;$env:Path" }
}

function NbWinget([string]$id, [string[]]$extra) {
    if (-not (NbHave 'winget')) {
        NbFail "winget is not available to install $id. Install it from the Microsoft Store (App Installer), or install $id yourself, then re-run."
    }
    NbInfo "winget install --id $id"
    & winget install --id $id -e --source winget --accept-package-agreements --accept-source-agreements @extra
    if ($LASTEXITCODE -ne 0) { NbFail "winget could not install $id (exit code $LASTEXITCODE)." }
    NbRefreshPath
}

function NbCheckGit {
    if (-not (NbHave 'git')) {
        NbWarn 'Git was not found.'
        if (-not $script:NbPrereqs -and -not (NbAskYesNo 'Install Git for Windows now with winget?' 'y')) {
            NbFail 'Git is required. Install it from https://git-scm.com/download/win and re-run.'
        }
        NbWinget 'Git.Git' @()
        if (-not (NbHave 'git')) { NbFail 'Git was installed but is not on PATH yet. Open a new PowerShell window and re-run.' }
    }
    NbOk ('git ' + ((& git --version) -replace '^git version ', ''))
}

function NbVsWithCpp {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path $vswhere)) { return $null }
    $p = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($p) { return ($p | Select-Object -First 1) }
    return $null
}

function NbCheckBuildTools {
    # Rust on Windows links with the MSVC linker from Visual Studio's C++ tools.
    $vs = NbVsWithCpp
    if ($vs) { NbOk "MSVC C++ build tools ($vs)"; return }
    NbWarn 'The MSVC C++ build tools (Visual Studio Build Tools, "Desktop development with C++") were not found.'
    if (-not $script:NbPrereqs -and -not (NbAskYesNo 'Install the Visual Studio Build Tools with the C++ workload now (a large download; Windows will ask for permission)?' 'y')) {
        NbFail 'The C++ build tools are required. Install them from https://visualstudio.microsoft.com/visual-cpp-build-tools/ ("Desktop development with C++") and re-run.'
    }
    NbWinget 'Microsoft.VisualStudio.2022.BuildTools' @('--override', '--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
    if (-not (NbVsWithCpp)) { NbFail 'The build tools installer finished, but the C++ tools were not found. Install "Desktop development with C++" from the Visual Studio Installer and re-run.' }
    NbOk 'MSVC C++ build tools installed'
}

function NbCheckRust {
    NbRefreshPath
    if ((NbHave 'cargo') -and (NbHave 'rustc')) {
        NbOk ('Rust ' + ((& rustc --version) -split ' ')[1] + ' (cargo ' + ((& cargo --version) -split ' ')[1] + ')')
        return
    }
    NbWarn 'Rust (cargo/rustc) was not found.'
    if (-not $script:NbPrereqs -and -not (NbAskYesNo 'Install Rust now using rustup (https://rustup.rs)?' 'y')) {
        NbFail 'Rust is required to build Newbound.'
    }
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'aarch64' } else { 'x86_64' }
    $exe = Join-Path $env:TEMP 'rustup-init.exe'
    NbInfo "Downloading rustup-init ($arch)"
    Invoke-WebRequest -UseBasicParsing -Uri "https://win.rustup.rs/$arch" -OutFile $exe -ErrorAction Stop
    & $exe -y --profile minimal --default-host "$arch-pc-windows-msvc"
    if ($LASTEXITCODE -ne 0) { NbFail "rustup-init failed (exit code $LASTEXITCODE)." }
    Remove-Item $exe -ErrorAction SilentlyContinue
    NbRefreshPath
    if (-not (NbHave 'cargo')) { NbFail 'Rust was installed but cargo is not on PATH yet. Open a new PowerShell window and re-run.' }
    NbOk ('Installed Rust ' + ((& rustc --version) -split ' ')[1])
}

# Sets $script:PyExe, PyHome, PyVersion, PyDevOk
function NbDetectPython {
    $script:PyExe = $null; $script:PyHome = $null; $script:PyVersion = $null; $script:PyDevOk = $false
    # Single quotes only inside the Python: Windows PowerShell 5.1 mangles
    # double quotes embedded in an argument it passes to a program.
    $probe = "import sys,os,glob,sysconfig; print(sys.executable); print(sys.base_prefix); print(sys.version.split()[0]); " +
             "inc=os.path.isfile(os.path.join(sysconfig.get_paths().get('include') or '','Python.h')); " +
             "lib=bool(glob.glob(os.path.join(sys.base_prefix,'libs','python3*.lib'))); print(1 if inc and lib else 0)"
    $tries = @()
    if (NbHave 'py') { $tries += , @('py', '-3') }
    if (NbHave 'python') { $tries += , @('python') }
    foreach ($t in $tries) {
        $cmd = $t[0]; $pre = @($t | Select-Object -Skip 1)
        $out = & $cmd @pre -c $probe 2>$null
        if ($LASTEXITCODE -eq 0 -and $out -and @($out).Count -ge 4) {
            $o = @($out)
            $script:PyExe = $o[0]; $script:PyHome = $o[1]; $script:PyVersion = $o[2]; $script:PyDevOk = ($o[3] -eq '1')
            return
        }
    }
}

# ---------------------------------------------------------------------------
# Build options and LLM questions (the same as install.sh)
# ---------------------------------------------------------------------------
function NbChooseFeatures {
    NbSection 'Build options'
    $script:Features = @()
    if ($script:OptSerde -eq '') { $script:OptSerde = if (NbAskYesNo 'Enable serde for JSON support (serde_support)?' 'y') { 'yes' } else { 'no' } }
    if ($script:OptSerde -eq 'yes') { $script:Features += 'serde_support' }

    NbDetectPython
    $default = 'n'
    if ($script:PyExe) {
        NbOk "Python $($script:PyVersion) found at $($script:PyExe)"
        if ($script:PyDevOk) { $default = 'y' }
        else { NbWarn 'Python headers or libs\python3*.lib not found; the Python runtime may not build. The python.org installer includes them.' }
    } else {
        NbInfo 'Python 3 was not found on this system (the python.org installer is the one to use).'
    }
    if ($script:OptPython -eq '') { $script:OptPython = if (NbAskYesNo 'Enable the Python runtime (python_runtime)?' $default) { 'yes' } else { 'no' } }
    if ($script:OptPython -eq 'yes') {
        if (-not $script:PyExe) { NbWarn 'Python runtime selected but Python 3 is not installed; the build will likely fail.' }
        $script:Features += 'python_runtime'
        if ($script:PyExe) {
            $env:PYO3_PYTHON = $script:PyExe
            # the server loads python3xx.dll at run time: put Python's folder first on PATH
            $env:Path = "$($script:PyHome);$env:Path"
        }
        # Let pyo3 build against a Python newer than it explicitly supports.
        $env:PYO3_USE_ABI3_FORWARD_COMPATIBILITY = '1'
    }
}

function NbChooseLlm {
    NbSection 'LLM configuration'
    NbInfo 'newbound-agent talks to an LLM through the LLM= arm in botd.properties.'
    $providers = @('VLLM', 'OPENAI', 'ANTHROPIC', 'GEMINI', 'OLLAMA', 'NONE')
    if ($script:OptLlm) {
        if ($providers -notcontains $script:OptLlm) { NbFail "Unknown -Llm provider '$($script:OptLlm)' (VLLM | OPENAI | ANTHROPIC | GEMINI | OLLAMA | NONE)" }
    } else {
        $script:OptLlm = NbAskChoice 'Which LLM should the agent use?' 'OLLAMA' $providers
    }
    if ($script:OptLlm -eq 'NONE') { NbInfo 'Skipping LLM setup; configure botd.properties later.'; return }

    switch ($script:OptLlm) {
        'VLLM' {
            NbInfo 'vLLM serves an OpenAI-compatible endpoint (often on your own hardware).'
            if (-not $script:OptUrl)   { $script:OptUrl = NbAskString 'vLLM endpoint URL?' 'http://127.0.0.1:8000/v1/chat/completions' }
            if (-not $script:OptModel) { $script:OptModel = NbAskString 'Model name (as the server reports it)?' '' }
            if (-not $script:OptModel) { NbFail 'VLLM requires a model name (VLLM_MODEL).' }
            if ($null -eq $script:OptKey) {
                $script:OptKey = ''
                if (NbAskYesNo 'Does this server require an API key (-ApiKey)?' 'n') { $script:OptKey = NbAskString 'API key?' '' -Secret }
            }
        }
        'OPENAI' {
            NbInfo 'OpenAI proper, or any OpenAI-compatible endpoint (LM Studio, llama.cpp, Groq, OpenRouter, Moonshot, ...).'
            if (-not $script:OptUrl -and -not (NbAskYesNo 'Use the official api.openai.com endpoint?' 'y')) {
                $script:OptUrl = NbAskString 'Endpoint URL?' 'http://127.0.0.1:1234/v1/chat/completions'
            }
            if (-not $script:OptModel) { $script:OptModel = NbAskString 'Model name?' 'gpt-4o-mini' }
            if (-not $script:OptModel) { NbFail 'OPENAI requires a model name (OPENAI_MODEL).' }
            if ($null -eq $script:OptKey) {
                if (-not $script:OptUrl) {
                    $script:OptKey = NbAskString 'OpenAI API key?' '' -Secret
                    if (-not $script:OptKey) { NbFail 'api.openai.com requires an API key (OPENAI_KEY).' }
                } else {
                    $script:OptKey = NbAskString 'API key (leave blank if the endpoint is keyless)?' '' -Secret
                }
            }
        }
        'ANTHROPIC' {
            NbInfo "Anthropic's native Messages API."
            if (-not $script:OptModel) { $script:OptModel = NbAskString 'Model?' 'claude-opus-5' }
            if ($null -eq $script:OptKey) { $script:OptKey = NbAskString 'Anthropic API key (x-api-key)?' '' -Secret }
            if (-not $script:OptKey) { NbFail 'ANTHROPIC requires an API key (ANTHROPIC_KEY).' }
            $script:OptEffort = NbAskString 'Effort for thinking models (low|medium|high|xhigh; blank for default)?' ''
        }
        'GEMINI' {
            NbInfo "Google's native generateContent API."
            if (-not $script:OptModel) { $script:OptModel = NbAskString 'Model?' 'gemini-3.6-flash' }
            if ($null -eq $script:OptKey) { $script:OptKey = NbAskString 'Gemini API key?' '' -Secret }
            if (-not $script:OptKey) { NbFail 'GEMINI requires an API key (GEMINI_KEY).' }
        }
        'OLLAMA' {
            NbInfo 'Ollama running locally (or a hosted Ollama with a key).'
            if (-not $script:OptUrl)   { $script:OptUrl = NbAskString 'Ollama URL?' 'http://127.0.0.1:11434/api/chat' }
            if (-not $script:OptModel) { $script:OptModel = NbAskString 'Model (e.g. llama3.1, qwen3)?' '' }
            if (-not $script:OptModel) { NbFail 'OLLAMA requires a model name (OLLAMA_MODEL).' }
            $script:OptKeepAlive = NbAskString 'Keep the model resident (e.g. 5m; blank = unload after each call)?' ''
            if ($null -eq $script:OptKey) {
                $script:OptKey = ''
                if ($script:OptUrl -notlike 'http://127.0.0.1*' -and $script:OptUrl -notlike 'http://localhost*') {
                    $script:OptKey = NbAskString 'Hosted Ollama API key (blank if none)?' '' -Secret
                }
            }
        }
    }
    NbOk "LLM: $($script:OptLlm)  model: $($script:OptModel)"
}

# ---------------------------------------------------------------------------
# Installation steps
# ---------------------------------------------------------------------------
function NbGit([string[]]$a) {
    & git @a
    if ($LASTEXITCODE -ne 0) { NbFail "git $($a -join ' ') failed (exit code $LASTEXITCODE)." }
}

function NbCloneOrUpdate([string]$url, [string]$dest, [string[]]$regenerated = @()) {
    $name = Split-Path $dest -Leaf
    if (Test-Path (Join-Path $dest '.git')) {
        NbInfo "$name already cloned; pulling latest changes"
        # Files this installer writes itself would block a pull; they are rewritten below.
        foreach ($f in $regenerated) {
            & git -C $dest ls-files --error-unmatch $f *> $null
            if ($LASTEXITCODE -eq 0) { & git -C $dest checkout -- $f }
        }
        & git -C $dest pull --ff-only
        if ($LASTEXITCODE -ne 0) { NbWarn "Could not fast-forward $name; using the existing checkout." }
    } elseif (Test-Path $dest) {
        NbFail "$dest exists but is not a git checkout. Move it aside and re-run."
    } else {
        NbInfo "Cloning $url"
        # LF line endings, as on Linux and macOS: the store and the generated
        # sources are shared with them, and Git for Windows would convert.
        NbGit @('clone', '-c', 'core.autocrlf=false', $url, $dest)
    }
    NbOk "$name ready"
}

function NbMakeLink([string]$target, [string]$link) {
    # A junction: unlike a symbolic link it needs neither admin rights nor
    # Developer Mode. Newbound itself links imported libraries the same way.
    $item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
    if ($item) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($link) }
        else { NbFail "$link exists and is not a link. Remove it and re-run." }
    }
    New-Item -ItemType Junction -Path $link -Target $target -ErrorAction Stop | Out-Null
    NbOk ("Linked " + (Split-Path (Split-Path $link -Parent) -Leaf) + '\' + (Split-Path $link -Leaf) + " -> $target")
}

function NbInstallNewbound {
    NbSection "Installing Newbound into $($script:InstallDir)"
    $parent = Split-Path $script:InstallDir -Parent
    if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -ErrorAction Stop | Out-Null }
    NbCloneOrUpdate $script:RepoUrl $script:InstallDir @('newbound.cmd')

    $repos = Join-Path $script:InstallDir 'repositories'
    if (-not (Test-Path $repos)) { New-Item -ItemType Directory -Path $repos -ErrorAction Stop | Out-Null }
    $agentRepo = Join-Path $repos 'newbound-agent'
    NbCloneOrUpdate $script:AgentRepoUrl $agentRepo

    if (-not (Test-Path (Join-Path $agentRepo 'agent'))) { NbFail "newbound-agent is missing its 'agent' directory; the repository layout may have changed." }
    if (-not (Test-Path (Join-Path $agentRepo 'data\agent'))) { NbFail "newbound-agent is missing 'data\agent'; the repository layout may have changed." }

    $data = Join-Path $script:InstallDir 'data'
    if (-not (Test-Path $data)) { New-Item -ItemType Directory -Path $data -ErrorAction Stop | Out-Null }
    NbMakeLink (Join-Path $agentRepo 'agent') (Join-Path $script:InstallDir 'agent')
    NbMakeLink (Join-Path $agentRepo 'data\agent') (Join-Path $data 'agent')
}

function NbCargoArgs {
    $a = @('run', '--release')
    if ($script:Features.Count -gt 0) { $a += ('--features=' + ($script:Features -join ',')) }
    return $a
}

function NbParkExe {
    # A running newbound.exe is locked and cargo could not replace it.
    # Windows allows renaming it: move it aside and put a copy (timestamp
    # kept) back, so an unchanged build stays fresh.
    $exe = Join-Path $script:InstallDir 'target\release\newbound.exe'
    if (-not (Test-Path $exe)) { return }
    Get-ChildItem "$exe.old-*" -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
    $park = "$exe.old-installer-" + [guid]::NewGuid().ToString('N').Substring(0, 8)
    try { Move-Item -LiteralPath $exe -Destination $park -ErrorAction Stop; Copy-Item -LiteralPath $park -Destination $exe } catch { }
}

function NbBuild {
    NbSection 'Building Newbound'
    $a = NbCargoArgs
    NbInfo ('Features: ' + $(if ($script:Features.Count) { $script:Features -join ',' } else { '(none)' }))
    Push-Location $script:InstallDir
    try {
        foreach ($step in 'rebuild', 'recompile') {
            NbParkExe
            NbInfo ("cargo " + ($a -join ' ') + " $step")
            & cargo @a $step
            if ($LASTEXITCODE -ne 0) { NbFail "cargo $($a -join ' ') $step failed (exit code $LASTEXITCODE)." }
            NbOk "$((Get-Culture).TextInfo.ToTitleCase($step)) complete"
        }
    } finally { Pop-Location }
}

function NbWriteUtf8([string]$path, [string]$text) {
    # UTF-8 without a BOM: Windows PowerShell 5.1's own encodings add one,
    # and it would glue itself to the first key.
    [IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding $false))
}

# Write runtime\agent\botd.properties from the answers collected in NbChooseLlm.
# Never clobber an existing file unless every setting came from flags (-Yes).
function NbWriteBotd {
    if (-not $script:OptLlm -or $script:OptLlm -eq 'NONE') { return }
    NbSection 'Writing agent LLM configuration'
    $dir = Join-Path $script:InstallDir 'runtime\agent'
    $file = Join-Path $dir 'botd.properties'
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -ErrorAction Stop | Out-Null }
    if ((Test-Path $file) -and -not $script:NbYes) {
        NbWarn "$file already exists."
        if (-not (NbAskYesNo 'Overwrite it with the settings you just gave?' 'y')) {
            NbInfo 'Keeping existing botd.properties; your new answers were not written.'
            return
        }
    }
    $k = $script:OptKey
    $l = @(
        '# newbound-agent LLM configuration',
        "# Generated by the installer on $(Get-Date -Format yyyy-MM-dd).",
        '# agent.llm.chat_llm reads LLM= to pick a provider arm; the <ARM>_* keys',
        '# below feed it. Edit and restart newbound to change providers.',
        '',
        "LLM=$($script:OptLlm)"
    )
    switch ($script:OptLlm) {
        'VLLM'      { $l += "VLLM_URL=$($script:OptUrl)"; $l += "VLLM_MODEL=$($script:OptModel)"; if ($k) { $l += "VLLM_KEY=$k" } }
        'OPENAI'    { if ($script:OptUrl) { $l += "OPENAI_URL=$($script:OptUrl)" }; $l += "OPENAI_MODEL=$($script:OptModel)"; if ($k) { $l += "OPENAI_KEY=$k" } }
        'ANTHROPIC' { $l += "ANTHROPIC_MODEL=$($script:OptModel)"; $l += "ANTHROPIC_KEY=$k"; if ($script:OptEffort) { $l += "ANTHROPIC_EFFORT=$($script:OptEffort)" } }
        'GEMINI'    { $l += "GEMINI_MODEL=$($script:OptModel)"; $l += "GEMINI_KEY=$k" }
        'OLLAMA'    { $l += "OLLAMA_URL=$($script:OptUrl)"; $l += "OLLAMA_MODEL=$($script:OptModel)"; if ($k) { $l += "OLLAMA_KEY=$k" }; if ($script:OptKeepAlive) { $l += "OLLAMA_KEEP_ALIVE=$($script:OptKeepAlive)" } }
    }
    $l += '', '# Shared tuning (read by every arm)', 'LLM_MAX_TOKENS=8192', 'LLM_TEMPERATURE=0.2'
    NbWriteUtf8 $file (($l -join "`n") + "`n")
    # The counterpart of chmod 600: drop inherited access, leave only you.
    $me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $file /inheritance:r /grant:r "${me}:F" *> $null
    if ($LASTEXITCODE -eq 0) { NbOk "Wrote $file (readable only by $me)" }
    else { NbWarn "Wrote $file, but could not restrict its permissions; it holds API keys." }
}

function NbWriteLauncher {
    NbSection 'Writing launcher script'
    $launcher = Join-Path $script:InstallDir 'newbound.cmd'
    $run = 'cargo ' + ((NbCargoArgs) -join ' ') + ' %*'
    $l = @(
        '@echo off',
        'rem Launches Newbound with the features chosen at install time.',
        "rem Generated by the Newbound installer on $(Get-Date -Format yyyy-MM-dd); re-run the installer to change features.",
        'setlocal',
        'cd /d "%~dp0"'
    )
    if ($script:OptPython -eq 'yes') {
        $l += 'set PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1'
        if ($script:PyExe) {
            $l += "set ""PYO3_PYTHON=$($script:PyExe)"""
            $l += "set ""PATH=$($script:PyHome);%PATH%"""
        }
    }
    $l += @(
        'rem A running newbound.exe is locked: move it aside and put an unlocked',
        'rem copy back, so cargo can relink it.',
        'set "EXE=target\release\newbound.exe"',
        'if not exist "%EXE%" goto run',
        'del /q "%EXE%.old-*" >nul 2>&1',
        'set "PARK=%EXE%.old-launcher-%RANDOM%%RANDOM%"',
        'move /y "%EXE%" "%PARK%" >nul 2>&1 || goto run',
        'copy /y "%PARK%" "%EXE%" >nul',
        ':run',
        $run
    )
    # CRLF: cmd can mis-find goto labels in LF-only batch files.
    NbWriteUtf8 $launcher (($l -join "`r`n") + "`r`n")
    NbOk "Wrote $launcher"
}

function NbSummary {
    $features = if ($script:Features.Count) { $script:Features -join ',' } else { 'none' }
    NbSection 'Newbound installed successfully'
    Write-Host "  Location:  $($script:InstallDir)"
    Write-Host "  Features:  $features"
    if ($script:OptLlm -and $script:OptLlm -ne 'NONE') {
        Write-Host "  LLM:       $($script:OptLlm) ($($script:OptModel))"
        Write-Host "  Config:    $(Join-Path $script:InstallDir 'runtime\agent\botd.properties')"
    }
    Write-Host ''
    Write-Host '  To start Newbound:'
    Write-Host "    & '$(Join-Path $script:InstallDir 'newbound.cmd')'"
    Write-Host "  (runs: cargo $((NbCargoArgs) -join ' '))"
    Write-Host ''
    Write-Host '  On first start Windows Firewall asks whether newbound.exe may accept'
    Write-Host '  connections: allow it so peers on your network can find this one.'
    if ($script:OptLlm -and $script:OptLlm -ne 'NONE') {
        Write-Host '  Then open the Agent app and start chatting - the LLM settings are already in place.'
    }
    Write-Host '  If cargo is not found in a new window, open a new PowerShell window (rustup updates PATH for new ones).'
    Write-Host ''
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
function Invoke-NewboundInstall {
    # Local to this function, not your session. Not 'Stop': Windows PowerShell
    # 5.1 can turn a native tool's stderr (git and cargo progress) into a
    # terminating error. Every native command's exit code is checked instead,
    # and the cmdlets that must not fail quietly carry -ErrorAction Stop.
    $ErrorActionPreference = 'Continue'
    $ProgressPreference = 'SilentlyContinue'
    # Windows PowerShell 5.1 can default to old TLS versions for downloads.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    Write-Host 'Newbound installer - Newbound + newbound-agent (Windows)'

    NbSection 'Checking prerequisites'
    if ($env:OS -ne 'Windows_NT') { NbWarn 'This is the Windows installer; on Linux and macOS use install.sh.' }
    NbCheckGit
    NbCheckBuildTools
    NbCheckRust

    NbChooseFeatures
    NbChooseLlm

    NbSection 'Ready to install'
    Write-Host "  Directory: $($script:InstallDir)"
    Write-Host ('  Features:  ' + $(if ($script:Features.Count) { $script:Features -join ' ' } else { 'none' }))
    if ($script:OptLlm -and $script:OptLlm -ne 'NONE') { Write-Host "  LLM:       $($script:OptLlm)  model: $($script:OptModel)" }
    else { Write-Host '  LLM:       (configure later in runtime\agent\botd.properties)' }
    if (-not (NbAskYesNo 'Proceed?' 'y')) { NbInfo 'Cancelled. No changes made.'; return $true }

    NbInstallNewbound
    NbBuild
    NbWriteBotd
    NbWriteLauncher
    NbSummary
    return $true
}

$script:NbColor = -not $NoColor -and -not $env:NO_COLOR
if ($Help) {
    Write-Host @'
Newbound installer for Windows

  irm https://newbound.com/install.ps1 | iex
  & ([scriptblock]::Create((irm https://newbound.com/install.ps1))) -Llm OLLAMA -Model qwen3 -Yes

Options: -Dir DIR  -Serde|-NoSerde  -Python|-NoPython  -InstallPrereqs
         -Llm VLLM|OPENAI|ANTHROPIC|GEMINI|OLLAMA|NONE  -OpenAIUrl URL  -Model M
         -ApiKey KEY  -NoApiKey  -Yes  -NoColor  -Help
Environment: NEWBOUND_DIR, NEWBOUND_REPO, NEWBOUND_AGENT_REPO
'@
} else {
    # Options into script variables (in `irm | iex` these live in your
    # session's scope; their names start with Opt/Nb to stay out of the way).
    $script:NbYes = [bool]$Yes
    $script:NbPrereqs = [bool]$InstallPrereqs
    $script:OptSerde = if ($Serde) { 'yes' } elseif ($NoSerde) { 'no' } else { '' }
    $script:OptPython = if ($Python) { 'yes' } elseif ($NoPython) { 'no' } else { '' }
    $script:OptLlm = $Llm.ToUpper()
    $script:OptUrl = $OpenAIUrl
    if ($OpenAIUrl) { $script:OptLlm = 'OPENAI' }
    $script:OptModel = $Model
    $script:OptKey = if ($NoApiKey) { '' } elseif ($ApiKey) { $ApiKey } else { $null }
    $script:OptEffort = ''; $script:OptKeepAlive = ''
    $script:Features = @()
    $script:RepoUrl = if ($env:NEWBOUND_REPO) { $env:NEWBOUND_REPO } else { 'https://github.com/mraiser/newbound.git' }
    $script:AgentRepoUrl = if ($env:NEWBOUND_AGENT_REPO) { $env:NEWBOUND_AGENT_REPO } else { 'https://github.com/mraiser/newbound-agent.git' }
    $d = if ($Dir) { $Dir } elseif ($env:NEWBOUND_DIR) { $env:NEWBOUND_DIR } else { Join-Path (Get-Location).Path 'newbound' }
    $script:InstallDir = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($d)) { $d } else { Join-Path (Get-Location).Path $d }))

    $nbOk = $false
    try { $nbOk = Invoke-NewboundInstall }
    catch {
        NbErr "Installation failed: $($_.Exception.Message)"
        NbErr 'Fix the problem above and re-run the installer; completed steps are skipped.'
    }
    # Only a script run as a file may set an exit code; under `irm | iex`
    # exit would close your PowerShell window.
    if (-not $nbOk -and $PSCommandPath) { exit 1 }
}
