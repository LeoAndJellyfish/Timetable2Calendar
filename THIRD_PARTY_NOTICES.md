# Third-party notices

The application includes the following locally hosted Fontsource fonts. They retain their original licenses; the project's MIT license does not replace them.

- EB Garamond — SIL Open Font License 1.1. License: `public/fonts/eb-garamond-LICENSE.txt`.
- Inter — SIL Open Font License 1.1. License: `public/fonts/inter-LICENSE.txt`.
- Noto Sans SC — SIL Open Font License 1.1. License: `public/fonts/noto-sans-sc-LICENSE.txt`.

Only the font weights and character sets needed by the interface are included. Fonts are served with the application; there are no third-party font requests.

## Runtime dependencies

| Dependency | License |
| --- | --- |
| React / React DOM | MIT |
| Lucide React | ISC |
| linkedom | ISC |
| PDF.js / pdfjs-dist | Apache-2.0 |

Dependencies are installed through npm and retain the license files in their respective packages. The PDF preparation script copies PDF.js's LICENSE, CMap files and standard fonts to the build, including the Liberation and Foxit font licenses supplied by PDF.js. Preserve those notices when distributing the built website.
