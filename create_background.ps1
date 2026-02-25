$pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
$bytes = [Convert]::FromBase64String($pngBase64)
[System.IO.File]::WriteAllBytes("C:\Users\educa\Desktop\MEDICARE\client\assets\background.png", $bytes)
Write-Host "Created background.png"
