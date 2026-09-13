param([string]$OutDir = 'tmp/icon')

Add-Type -AssemblyName System.Drawing

$sizes = 16, 24, 32, 48, 64, 128, 256
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [Math]::Max(1, [Math]::Round($s * 0.06))
  $rect = New-Object System.Drawing.RectangleF($pad, $pad, ($s - 2 * $pad), ($s - 2 * $pad))
  $radius = $s * 0.2
  $d = 2 * $radius
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()

  $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 23, 23, 23))
  $g.FillPath($bgBrush, $path)

  $tw = $s * 0.3
  $th = $s * 0.36
  $cx = $s * 0.54
  $cy = $s * 0.5
  $pts = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF($cx, ($cy - $th / 2))),
    (New-Object System.Drawing.PointF($cx, ($cy + $th / 2))),
    (New-Object System.Drawing.PointF(($cx + $tw), $cy))
  )
  $playBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 224, 58, 58))
  $g.FillPolygon($playBrush, $pts)

  $g.Dispose()
  $bmp.Save((Join-Path $OutDir "$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Write-Host "generated $($sizes.Count) pngs in $OutDir"
