$proc = Start-Process npm -ArgumentList "--prefix web run preview" -PassThru
Start-Sleep -Seconds 4
try {
    $res = Invoke-WebRequest -Uri "http://localhost:4173" -UseBasicParsing
    Write-Host "Server status code: " $res.StatusCode
    if ($res.Content -match "<title>(.*?)</title>") {
        Write-Host "Page title: " $matches[1]
    }
} catch {
    Write-Host "Error connecting to server: " $_.Exception.Message
} finally {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
