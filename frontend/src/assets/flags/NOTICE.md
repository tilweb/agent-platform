# Runde Länderflaggen — Herkunft & Lizenz

Die SVG-Flaggen in diesem Ordner stammen aus dem Projekt **circle-flags**:

- Quelle: https://github.com/HatScripts/circle-flags
- Lizenz der Flaggen-SVGs: **MIT**
- Vendored (nicht als Paket-Dependency), damit die App self-contained bleibt
  (keine externen Requests / CDN — CSP-konform).

Das vollständige Set ist eingecheckt (inkl. `eu`, `un` = International/Globus,
`xx` = neutraler Platzhalter). `CountryFlag.jsx` löst jeden ISO-Code per
`import.meta.glob` auf; der Browser lädt nur die tatsächlich gerenderten Flaggen.
Update bei Bedarf aus der Quelle (gh-pages/flags/*.svg).

## MIT License (circle-flags)

Copyright (c) HatScripts

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
