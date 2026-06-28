# Close the 同花顺 Wencai AI-assistant auxiliary window if it is open.
# This prevents the desktop trading agent from accidentally binding to it.

$wencai = Get-Process -Name 'hexin' -ErrorAction SilentlyContinue | ForEach-Object {
    $_.MainWindowTitle
} | Where-Object { $_ -like '*问财AI助手*' }

if (-not $wencai) {
    Write-Output 'No Wencai AI-assistant window found.'
    exit 0
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
"@

$found = $false
foreach ($proc in Get-Process -Name 'hexin' -ErrorAction SilentlyContinue) {
    if ($proc.MainWindowTitle -like '*问财AI助手*') {
        [Win32]::PostMessage($proc.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
        Write-Output "Sent WM_CLOSE to Wencai window: $($proc.MainWindowTitle)"
        $found = $true
    }
}

if (-not $found) {
    Write-Output 'No Wencai AI-assistant window found by title.'
}
