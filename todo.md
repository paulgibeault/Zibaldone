# Zibaldone Roadmap / Todo

## Core System Improvements
- [x] **Enhanced Upload Context**: Extract detailed context from the client during file upload (client info, browser info, full file path, OS user info) to better track and understand selected files.
- [x] **Recursive Folder Support**: Enable uploading entire folders recursively.
- [x] **Queue Management**: Efficiently manage upload and processing queues to handle large batches of files.
- [x] **Smart Versioning**: Use client info and full file path to determine if a file is new or a new version of an existing file.
- [x] **Dynamic File Processing**: Enable execution and tracking of processing tasks at the ContentItem level. Align to accepted task management standards/frameworks (e.g. Atomic Agents).
- [ ] **Failed Task Visibility**: 
    - [ ] Make failed tasks more visible in the UI.
    - [ ] Allow restarting failed tasks individually or in bulk.

## Explore View
- [x] **Tag Filtering**: 
    - [x] Clicking a tag should filter files containing that tag.
    - [x] Tags should behave as toggles (on/off).
    - [x] Support multi-select toggles with intersection logic (files must contain *all* selected tags).
- [ ] **Project Tab**:
    - [ ] Create a dedicated "Project" tab acting as a workspace.
    - [ ] Define workspace semantics and how it supports creativity (heap exploration vs focused content creation).
    - [ ] Allow curation of disparate files into a single project.

## Notebook Tab
- [ ] **Project Definition**: Create a space to define "Projects" containing sets of tags.
- [ ] **Skills Framework**: Implement Anthropic's "Agent Skills" architecture:
    - [ ] **Structure**: A skill is a directory containing a `SKILL.md` file.
    - [ ] **Metadata**: `SKILL.md` starts with YAML frontmatter (`name`, `description`) which is pre-loaded into the system prompt.
    - [ ] **Progressive Disclosure**:
        - **Level 1**: Metadata (Name/Desc) guides selection.
        - **Level 2**: `SKILL.md` body provides core instructions (loaded on demand).
        - **Level 3**: Additional files (e.g., `reference.md`, scripts) linked from `SKILL.md` (loaded only when specifically needed).
    - [ ] **Code Execution**: Skills can include executable scripts (e.g., Python tools) for deterministic operations.
- [x] **Sorting**: Sort items by "date updated".
- [x] **Source Visibility**: Display which client a file was last uploaded from.

## UI/UX Refinements
- [x] **Generated Titles**: Files should use a generated title displayed on file cards.
- [x] **Rich Content Display**: 
    - [x] Attempt to display content directly in the file card view tab (Text, Markdown, Image, Video).
    - [ ] **Markdown Rendering**: Ensure markdown is correctly rendered in rich content display.
    - [x] Provide an option to select an external tool for unrecognized file types.
- [x] **Maximized View**: Maximized file cards should occupy the entire width of the screen.
- [x] **File Card Tags**:
    - [x] Minimized View: Text-based tags (remove pills), appropriate color, comma delimited.
    - [x] Support two lines of text; mouseover shows full list.
- [x] **File Card Summary Tab**:
    - [x] Show only Version (remove File and Created).
    - [x] Use a more design-centric placement for version info.
- [x] **File Card Processing History**:
    - [x] List most recent tasks first.
    - [x] Make section scrollable and collapsible.

## Admin & User Management
- [x] **Admin UI**: Interface to create and send invitations.
- [x] **Device Management**: User UI to list and manage connected devices.

## Known Issues
- [x] **Profile UI**: Fix error when saving profile changes.
