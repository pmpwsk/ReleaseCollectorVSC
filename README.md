# ReleaseCollectorVSC
Visual Studio Code extension that builds your .NET project for various systems and collects the files in one folder.

Website: https://uwap.org/projects/release-collector-vsc

Version for Visual Studio: https://marketplace.visualstudio.com/items?itemName=uwap-org.uwap-ReleaseCollector

Repository on GitHub >> https://github.com/pmpwsk/ReleaseCollectorVSC

## Main features
- Publishing projects for multiple systems at once without creating any publish profiles or scripts
- Creating a .zip file for every build configuration for executables
- Creating a .dll file (and .nuget file if configured in the .csproj file) for libraries
- Optional version incrementation (builds are stored according to the version)

Features for executables only (libraries are always single .dll files):
- Project configuration file specifying exactly which build configurations to use
- Framework-dependent or self-contained builds (or both)
- Inclusion of files/directories in the builds, allowing different ones for different build configurations

## Installation
You can find this extension on the Visual Studio marketplace as: [ReleaseCollector](https://marketplace.visualstudio.com/items?itemName=uwap-org.uwap-releasecollector-vsc)

Alternatively, you can download the .vsix file from the [releases on GitHub](https://github.com/pmpwsk/ReleaseCollectorVSC/releases) and open it to install the extension.

## Usage
To execute the command, open the command palette (Ctrl+Shift+P) and enter/select <code>Publish and collect</code>.

The extension may ask you to select a new version for your project (see more below).

After that, it will build everything and show you a notification saying "Success!" once that's done.

Your build files will be located in bin/Publish or bin/Publish/[VERSION].

## Settings
By default, the extension deletes the bin/Release folder once it's done to save space. If you would like to keep it because you would unzip the builds anyway, go to VSC's settings and search for "ReleaseCollector" and turn off "Delete Release Folder".

## ReleaseCollector.conf file
This file allows you to list what configurations you would like to build, each line is one configuration.

It should be placed directly in your project folder. If it doesn't exist, the extension will use the default list of configurations consisting of all popular platforms with both FD and SC.

The syntax is as follows:<br/>[RUNTIME]_[TYPE]
- RUNTIME can be any runtime identifier according to the dotnet command, such as <code>linux-x64</code>
- TYPE can be either <code>fd</code> for a framework-dependent or <code>sc</code> for a self-contained build - FD builds require the user to have the appropriate .NET version installed, SC builds don't

Example: <code>linux-x64_fd</code>

To include files or directories with a build configuration, add " + [PATH]" (space+plus+space) to the line. Use forward slashes (/) regardless of which platform you are building on.

Lines can contain different inclusions, such as different library files for different platforms. Paths are relative to the project folder, switching to parent folders using ".." is possible.

Example:<br/><code>linux-arm64_sc + ../BASS/Linux/libbass.so + Sounds/test.mp3</code><br/><code>win-x64_fd + ../BASS/Windows/bass.dll + Sounds/test.mp3</code>

## Versions
If your .csproj file contains <code>&lt;Version&gt;[VERSION]&lt;/Version&gt;</code>, the extension will ask you whether to increase the version number and will include the version in the name of the resulting .dll or .zip files.

Additionally, there will be a new publish folder for every version so old versions are preserved.

When asked about increasing the version number, you will have five options (example is 1.2.3.4):
- 1.2.3.4 (no change)
- 1.2.3.5
- 1.2.4.0
- 1.3.0.0
- 2.0.0.0

Versions don't need to have all 4 segments (that's the maximum). If you don't select a more precise version, the segment count will stay the same (example 1.2):
- 1.2
- 1.2.0.1
- 1.2.1
- 1.3
- 2.0