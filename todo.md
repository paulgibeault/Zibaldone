# Zibaldone Roadmap / Todo

## Core System Improvements
- [x] **Enhanced Upload Context**: Extract detailed context from the client during file upload (client info, browser info, full file path, OS user info) to better track and understand selected files.
- [ ] **Recursive Folder Support**: Enable uploading entire folders recursively.
- [ ] **Queue Management**: Efficiently manage upload and processing queues to handle large batches of files.
- [x] **Smart Versioning**: Use client info and full file path to determine if a file is new or a new version of an existing file.
- [ ] **Dynamic File Processing**: Enable execution and tracking of processing tasks at the ContentItem level. Align to accepted task management standards/frameworks (e.g. Atomic Agents).

## Explore View
- [ ] **Tag Filtering**: 
    - [ ] Clicking a tag should filter files containing that tag.
    - [ ] Tags should behave as toggles (on/off).
    - [ ] Support multi-select toggles with intersection logic (files must contain *all* selected tags).
- [ ] **Project Creation**:
    - [ ] Add "New Project" button to create a project from current view (selected tags + pinned files).
- [ ] **File Pinning**:
    - [ ] Support pinning files; pinned files remain visible regardless of search/tag filters.
    - [ ] Display pinned files in a dedicated section on the right (visible only when items are pinned).
    - [ ] Allow curation of disparate files into a single project via pinning.

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
- [ ] **Generated Titles**: Files should use a generated title displayed on file cards.
- [ ] **Rich Content Display**: 
    - [ ] Attempt to display content directly in the file card view tab (Text, Markdown, Image, Video).
    - [ ] Provide an option to select an external tool for unrecognized file types.
- [ ] **Maximized View**: Maximized file cards should occupy the entire width of the screen.
- [ ] **File Card Tags**:
    - [x] Minimized View: Text-based tags (remove pills), appropriate color, comma delimited.
    - [x] Support two lines of text; mouseover shows full list.
- [ ] **File Card Summary Tab**:
    - [ ] Show only Version (remove File and Created).
    - [ ] Use a more design-centric placement for version info.
- [ ] **File Card Processing History**:
    - [ ] List most recent tasks first.
    - [ ] Make section scrollable and collapsible.

## Admin & User Management
- [ ] **Admin UI**: Interface to create and send invitations.
- [ ] **Device Management**: User UI to list and manage connected devices.

## Known Issues
- [ ] **Profile UI**: Fix error when saving profile changes.
