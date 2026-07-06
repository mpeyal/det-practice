// electron-builder afterPack hook: ad-hoc code-sign the macOS .app.
//
// Apple Silicon requires every binary to carry at least an ad-hoc signature,
// or a downloaded app shows "… is damaged and can't be opened." We have no
// paid Apple certificate, so we sign with the ad-hoc identity ("-"). This
// turns the hard "damaged" block into the normal right-click → Open flow.
// (Runs only on macOS builds; a no-op elsewhere.)

const { execSync } = require('node:child_process')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`
  try {
    execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'inherit' })
    console.log(`  • ad-hoc signed ${appName}.app`)
  } catch (e) {
    console.warn('  ! ad-hoc codesign failed:', e.message)
  }
}
