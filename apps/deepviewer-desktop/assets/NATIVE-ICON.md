# DeepViewer native macOS icon

`DeepViewer.icon/Assets/Whale.svg` is the original DeepViewer whale vector,
copied byte-for-byte from the shipped `deepviewer-loading-logo.svg` artwork
(SHA-256 `16896da065025e41040115cc8f16f0268a94200bd5ea3c939e27e3078dff1816`).
The Icon Composer document places that vector on a white background with a
dark foreground fill. It has no pre-masked background bitmap. Layer placement
preserves the existing brand composition in the 1024-point design canvas.

Xcode 26 or newer is required for a native desktop build or package. `actool`
compiles the document into `Assets.car`, the `DeepViewer` native icon and a
complete `DeepViewer.icns` fallback using `--standalone-icon-behavior all`.
The Apple compiler supplies the mask, appearance variants and legacy canvas
margins. Both the development carrier and release bundle declare
`CFBundleIconName=DeepViewer` and retain the matching ICNS fallback. The app
does not replace this bundle icon at runtime with `app.dock.setIcon`.

The old flattened PNGs remain in-app artwork only; they are not Dock or bundle
icon build inputs. The native About panel uses `icon.png`, extracted byte-for-byte
from Apple's largest compiled ICNS rendition. Core-only CI builds do not require
the icon compiler.

References: [Apple Icon Composer guidance](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer),
[Apple app icon design guidance](https://developer.apple.com/design/human-interface-guidelines/app-icons),
and the Xcode `actool(1)` manual for compiler output and partial Info.plist keys.
