# kipm

kipm is a command-line tool that helps you install and manage KiCad component libraries by automatically fetching symbols, footprints, and 3D models from LCSC/EasyEDA and converting them to KiCad format.

⚠️ **WARNING**: This tool is currently in early development. Please backup your project files before use.

For now this only supports LCSC part numbers (e.g., `C381039`) for quickly setting up your components and ordering from JLCPCB.

The conversion process uses the same method as [easyeda2kicad.py](https://github.com/uPesy/easyeda2kicad.py).

## Installation

Use with npx:
```bash
npx -y kipm <command>
```

Or install globally:
```bash
npm install -g kipm
```

## Usage

### Install a single component
```bash
kipm install <LCSC-component-id>
```

### Install multiple components
Create a `components.txt` file in your project root with one LCSC part number per line:

```txt
C381039
C25744
```

Then from your project directory run:
```bash
npx -y kipm
```
or
```bash
npx -y kipm install
```

## What it does

When you run kipm in a project named `my-board`, it creates:
- `my-board.kicad_sym` - Symbol library
- `my-board.pretty/` - Footprint library
- `my-board.3dshapes/` - 3D model files

It also updates:
- `sym-lib-table` - Adds and stars the symbol library
- `fp-lib-table` - Adds and stars the footprint library
- `components.json` - Tracks installed components to enable clean uninstallation

The libraries are named after your project directory and will be "starred" so they appear at the top when placing components in KiCad.

## Requirements
- KiCad 6.0 or later
- Node.js 14 or later
- Works on Windows, macOS, and Linux

## Example Workflow
1. Create a new KiCad project
2. Create a `components.txt` file with your LCSC part numbers
3. Run `npx -y kipm install`
4. Open your schematic - the components will be available in the project library

## Issues and Bugs
Please report any issues on the [GitHub issue tracker](https://github.com/yourusername/kipm/issues).

## License

MIT