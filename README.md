# Data 2 SSG (Working Title)

## Useage

- Node:

```shell
node generator.mjs
```

- Deno:

```shell
deno run --allow-read --allow-write generator.mjs
```

- Bun:

```shell
bun generator.mjs
```

## Design

### Level 0: No data, just index.html

_EARLIEST WORKING VERSION_: 0.1.0

Literially just move `index.html` to output without any transformations.

- Read `index.html` file
- Write content to public folder as `index.html`

### Level 1: No data, multiple single level HTML files

_EARLIEST WORKING VERSION_: 0.1.0

Move any HTML files to output without any transformations.

- Read all HTML files in directory
- If `index.html`, just copy as is
- Otherwise, create a directory with the name of the html file and copy the
  contents to `index.html` within that directory

### Level 3: No data, multiple nested HTML file

_EARLIEST WORKING VERSION_: 0.1.0

Move any HTML files to output without any transformations.

- Read all HTML files in directory
- If `index.html`, just copy as is
- Otherwise, create a directory with the name up to the first dot of the html
  file and:
  - If after is just `.html`, copy the contents to `index.html` within this
    innermost directory
  - Otherwise, create another directory within this directory by repeating the
    step above

### Level 4: No data, multiple HTML files with single level templates

### Level 4: No data, multiple HTML files with multi-level templates

### Level 5: Static data with just index.html (fill with slots)

### Level 6: Static data with index.html and templates

### Level 7: Dynamic data with just index.html

### Level 8: Dynamic data with index.html and templates

## Templating Language

Only two tags to consider: Overloads `template` and `slot`

### Template

```html
<template slot="template-name">Default if not found</template>
```

`template` is used to

### Slot

```html
<slot name="optional-name">Default Value</slot>
```

`slot` is
