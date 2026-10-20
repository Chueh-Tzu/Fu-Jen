$root = "C:\Users\zoe92\Projects\fjcu-immba"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:4173/")
$listener.Start()
Write-Host "serving $root on 4173"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.LocalPath)
  if ($path -eq "/") { $path = "/index.html" }
  $file = Join-Path $root ($path.TrimStart("/").Replace("/", "\"))
  if (-not (Test-Path $file -PathType Leaf)) {
    $ctx.Response.StatusCode = 404
    $ctx.Response.Close()
    continue
  }
  $ext = [IO.Path]::GetExtension($file).ToLower()
  $mime = switch ($ext) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".svg" { "image/svg+xml" }
    ".ico" { "image/x-icon" }
    ".mp4" { "video/mp4" }
    ".webm" { "video/webm" }
    default { "application/octet-stream" }
  }
  $len = (Get-Item $file).Length
  $ctx.Response.ContentType = $mime
  $ctx.Response.AddHeader("Accept-Ranges", "bytes")
  $range = $ctx.Request.Headers["Range"]
  $start = 0L
  $end = $len - 1
  if ($range -and $range -match "bytes=(\d*)-(\d*)") {
    if ($Matches[1] -ne "") { $start = [int64]$Matches[1] }
    if ($Matches[2] -ne "") { $end = [int64]$Matches[2] }
    $ctx.Response.StatusCode = 206
    $ctx.Response.AddHeader("Content-Range", "bytes $start-$end/$len")
  } else {
    $ctx.Response.StatusCode = 200
  }
  $count = $end - $start + 1
  $ctx.Response.ContentLength64 = $count
  $fs = [IO.File]::OpenRead($file)
  try {
    $fs.Seek($start, "Begin") | Out-Null
    $buffer = New-Object byte[] 65536
    $left = $count
    while ($left -gt 0) {
      $read = $fs.Read($buffer, 0, [Math]::Min($buffer.Length, $left))
      if ($read -le 0) { break }
      $ctx.Response.OutputStream.Write($buffer, 0, $read)
      $left -= $read
    }
  } finally {
    $fs.Close()
    $ctx.Response.Close()
  }
}
