# Web NFC Demo Application

This project is a demonstration application showcasing the capabilities of the Web NFC API for reading from and writing to NFC tags. It's built using Vue 3 and Vite.

Web NFC is a browser API that allows web applications to interact with NFC (Near Field Communication) tags. This enables use cases like reading product information, interacting with smart posters, or writing data to tags for various purposes.

## Using the Web NFC API

This application utilizes the Web NFC API to interact with NFC tags. The primary interface for this is `NDEFReader`.

### Core Concepts and Usage

1.  **Initializing `NDEFReader`**:
    To begin interacting with NFC tags, you first need to create an instance of `NDEFReader`:
    ```javascript
    const ndef = new NDEFReader();
    ```

2.  **Reading NFC Tags**:
    *   The `ndef.scan()` method is called to start listening for NFC tags. This will typically prompt the user for permission if it hasn't been granted already.
    *   The `ndef.onreading` event handler is triggered when an NDEF message is read from an NFC tag. The event object contains:
        *   `serialNumber`: The serial number of the scanned tag.
        *   `message`: An NDEF message object containing an array of `records`.

    **Example from `src/App.vue`**:
    ```javascript
    async function readNFC() {
      const ndef = new NDEFReader();
      await ndef.scan(); // Prompts user for permission and starts scanning
      ndef.onreading = (event) => {
        console.log("NFC Tag Scanned:");
        console.log("Serial Number:", event.serialNumber);
        console.log("NDEF Message Records:", event.message.records);
        // Update Vue reactive state with scanned data
        scannedTag.value.uuid = event.serialNumber;
        scannedTag.value.records = [];
        scannedTag.value.records.push(...event.message.records);
      };
      status.value.reading = true; // Update UI status
    }
    ```
    *(For the full context, see the `readNFC` function in [`src/App.vue`](./src/App.vue).)*

3.  **Writing to NFC Tags**:
    *   The `ndef.write()` method is used to write an NDEF message to an NFC tag.
    *   This method takes an NDEF message object, which includes an array of records to be written.
    *   It's important to ensure the records are correctly formatted according to the NDEF specifications.

    **Example from `src/App.vue`**:
    ```javascript
    async function writeNFC(records: NDEFRecord[]) {
      if (!records.length) return;
      const ndef = new NDEFReader();
      // Map application records to NDEFRecordInit format
      const recs = records.map((rec) => {
        const obj = {} as NDEFRecordInit;
        obj.recordType = rec.recordType;
        if (rec.mediaType) obj.mediaType = rec.mediaType;
        if (rec.id) obj.id = rec.id;
        if (rec.encoding) obj.encoding = rec.encoding;
        if (rec.lang) obj.lang = rec.lang;
        // Data needs to be decoded if it's not already in the correct format for writing
        if (rec.data) {
            obj.data = rec.recordType === "mime" ? rec.data : decodeRecord(rec);
        }
        return obj;
      });

      try {
        await ndef.write({ records: recs });
        console.log("Successfully wrote to NFC tag.");
      } catch (err) {
        console.error("Error writing to NFC tag:", err);
        alert("Error writing to tag: " + err);
      }
    }
    ```
    *(For the full context, see the `writeNFC` function in [`src/App.vue`](./src/App.vue).)*

### Understanding NDEF Records

NDEF (NFC Data Exchange Format) messages are composed of one or more NDEF records. Each record has a specific payload and type. Key properties of an `NDEFRecord` object include:

*   `recordType`: Specifies the type of the record (e.g., `"text"`, `"url"`, `"mime"`, `"empty"`).
*   `mediaType`: For records of type `"mime"`, this specifies the MIME type of the payload (e.g., `"application/json"`, `"image/png"`).
*   `data`: A `DataView` object containing the actual payload of the record. The interpretation of this data depends on the `recordType`, `mediaType`, and `encoding`.
*   `encoding`: For text records (`recordType="text"`), this specifies the encoding of the text data (e.g., `"utf-8"`).
*   `lang`: For text records, this can specify the language of the text (e.g., `"en"`, `"fr"`).
*   `id`: An optional identifier for the record.

In this application, the [`src/components/NDEFRecord.vue`](./src/components/NDEFRecord.vue) component is responsible for parsing and displaying these individual NDEF records from a scanned tag.

For a more detailed look at the structure of NDEF messages and records, including all possible types and properties, you can refer to the TypeScript definitions used in this project: [`src/@types/web-nfc.d.ts`](./src/@types/web-nfc.d.ts).

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
