$SrcRoot  = ".\src\app"
$OutDir   = ".\wta-snapshot"
$Encoding = [System.Text.UTF8Encoding]::new($false)
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$Parts = @(
  @{ Name = "wta_part1_api";              Pattern = "^app\\api\\" },
  @{ Name = "wta_part2_owner_admin_auth"; Pattern = "^app\\(owner|admin|auth)\\" },
  @{ Name = "wta_part3_member_coach_etc"; Pattern = "^app\\(member|coach|payment|components|lib|hooks|styles|layout|page)" }
)
$AllFiles = Get-ChildItem -Path $SrcRoot -Recurse -Include "*.ts","*.tsx" | Sort-Object FullName
Write-Host "총 파일 수: $($AllFiles.Count)"
foreach ($Part in $Parts) {
  $OutPath = Join-Path $OutDir "$($Part.Name).txt"
  $Buffer  = [System.Text.StringBuilder]::new()
  $Count   = 0
  foreach ($File in $AllFiles) {
    $Rel = $File.FullName.Replace((Resolve-Path $SrcRoot).Path + "\", "app\")
    if ($Rel -match $Part.Pattern) {
      [void]$Buffer.AppendLine("`r`n`r`n===== $Rel =====")
      [void]$Buffer.AppendLine([System.IO.File]::ReadAllText($File.FullName, [System.Text.Encoding]::UTF8))
      $Count++
    }
  }
  [System.IO.File]::WriteAllText($OutPath, $Buffer.ToString(), $Encoding)
  Write-Host "완료: $($Part.Name).txt ($Count 개 파일)"
}
Write-Host "저장 위치: $OutDir"