# Restore and focus the main 同花顺 (hexin.exe) trading terminal window.
# This is a helper for headless A-share desktop paper-trading tests.

$proc = Get-Process -Name 'hexin' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) {
    Write-Error 'hexin.exe not found. Launch 同花顺 first.'
    exit 1
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$h = $proc.MainWindowHandle
if ($h -eq [IntPtr]::Zero) {
    Write-Error "MainWindowHandle is zero for hexin.exe (PID $($proc.Id)). The main window may not exist."
    exit 1
}

# SW_RESTORE = 9
[Win32]::ShowWindow($h, 9) | Out-Null
[Win32]::SetForegroundWindow($h) | Out-Null
Write-Output "Restored hexin.exe PID=$($proc.Id) HWND=$h"
