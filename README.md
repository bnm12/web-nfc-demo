# Web NFC Tag Editor & Demo Application

This project is an advanced demonstration application showcasing the capabilities of the Web NFC API. It allows users to read from, write to, and manage NDEF records on NFC tags with an intuitive user interface. Built with Vue 3, Vite, and Tailwind CSS, it provides a comprehensive example of Web NFC interactions.

Web NFC is a browser API that enables web applications to interact with NFC (Near Field Communication) tags, facilitating use cases like reading product information, creating smart posters, or configuring devices.

## Features

*   **Read NFC Tags:** Scan NFC tags to view their NDEF (NFC Data Exchange Format) messages.
*   **Enhanced Record Display:**
    *   Records are displayed in a clear, organized list.
    *   Each record features a toggleable "details" section showing its ID, encoding, and language code.
    *   Rich rendering for common NDEF record types:
        *   **Text:** Displays plain text content.
        *   **URL:** Renders as a clickable hyperlink (opens in a new tab).
        *   **Image (MIME types like `image/png`, `image/jpeg`, `image/gif`):** Shows an inline preview of the image.
        *   **Video (MIME types like `video/mp4`):** Provides an inline video player with controls.
        *   **vCard (MIME type `text/vcard` or `text/x-vcard`):** Parses and displays vCard contact information.
        *   **Unknown/Generic Types:** Shows the raw record type, media type, a hex dump of the payload, and an attempted text decoding.
*   **Record Management:**
    *   **Add New Records:** Easily create new NDEF records via a user-friendly form.
        *   Supports Text, URL, and generic MIME type records.
        *   For MIME types, allows payload input via file upload (e.g., for images, videos, binary files) or direct text input (e.g., for JSON, XML, vCard data).
        *   Option to specify Record ID, Encoding (for text-based records), and Language (for text records).
    *   **Delete Records:** Remove individual records from the list before writing to a tag.
*   **Write to NFC Tags:** Write the composed list of NDEF records to an NFC tag.
*   **Improved User Experience:**
    *   Clear visual feedback and animations during scanning and writing operations.
    *   Informative tooltips on buttons, icons, and form fields for enhanced usability.
    *   Warnings for potentially large data sizes before writing, helping users avoid exceeding tag capacity.
*   **Modern Tech Stack:** Vue 3, Vite, TypeScript, Tailwind CSS.

## Screenshots

`[Screenshot of the main interface with various record types, e.g., text, image, URL, and vCard displayed. One record should have its details toggled open.]`
*Caption: Main interface displaying various NDEF record types with rich rendering.*

`[Screenshot of the 'Add New Record' form, perhaps with the 'MIME Type' selected to show file upload and text payload options.]`
*Caption: The "Add New Record" form, showing options for creating different record types.*

## How to Use

### 1. Prerequisites
*   A browser that supports Web NFC (e.g., Chrome for Android).
*   An Android device with NFC capabilities.
*   Ensure NFC is enabled on your device.

### 2. Reading Tags
1.  Click the **"Scan Tag"** button.
    *   Your browser may prompt you for permission to use NFC. Allow this.
    *   A status message "Scanning for NFC Tag..." will appear.
2.  Tap an NFC tag to your device's NFC reader.
3.  The application will display the tag's UID (if available) and a list of its NDEF records.
4.  Records are automatically rendered based on their type (Text, URL, Image, Video, vCard, etc.).

### 3. Interpreting Records
*   **Rich Previews:** Common types like URLs, text, images, and videos are displayed in a user-friendly format.
*   **Details Toggle:** Each record has a chevron icon (▼/▲). Click this to show or hide detailed information about the record, such as its ID, specific encoding, and language code.
*   **Fallback Display:** If a record type isn't specifically handled, its raw type, media type, a hexadecimal representation of its data, and an attempted text decoding will be shown.

### 4. Adding a New Record
1.  Click the **"Add New Record"** button. This will open a form.
2.  **Fill out the form:**
    *   **Record Type:**
        *   `Text`: For plain text content.
        *   `URL`: For web links.
        *   `MIME Type`: For any other data type (images, videos, JSON, vCard, custom binary data, etc.).
    *   **MIME Type (if "Record Type" is "MIME Type"):** Enter the specific MIME type for your data (e.g., `image/png`, `application/json`, `text/vcard`). This is crucial for correct interpretation by other NFC devices/apps.
    *   **Payload Data:**
        *   For `Text` and `URL` types: A textarea will appear for you to input the text or URL.
        *   For `MIME Type`:
            *   **File Payload:** You can upload a file. The application will attempt to auto-fill the MIME Type field from the file's type if it's empty.
            *   **Or Text Payload for MIME type:** Alternatively, if your MIME type is text-based (like `application/json`, `text/xml`, `text/vcard`), you can directly type or paste the content into the provided textarea. This is used if no file is selected.
    *   **Record ID (Optional):** A unique identifier for this specific record within the NDEF message.
    *   **Encoding (Conditional):** For `Text` records and text-based `MIME` records, you can specify the text encoding (default is `utf-8`).
    *   **Language Code (Conditional):** For `Text` records, you can specify the language code (e.g., `en`, `fr-CA`; default is `en`).
3.  Click **"Create Record"**. The new record will be added to the list displayed in the app. This does *not* write it to the tag yet.

**Examples for Adding Common Types:**
*   **Adding a Text record:**
    1.  Record Type: `Text`
    2.  Text Data: Enter your desired text.
    3.  (Optional) Set Encoding and Language Code.
    4.  Click "Create Record".
*   **Adding a URL record:**
    1.  Record Type: `URL`
    2.  URL: Enter the full URL (e.g., `https://example.com`).
    3.  Click "Create Record".
*   **Adding an Image record:**
    1.  Record Type: `MIME Type`
    2.  MIME Type: Enter the image's MIME type (e.g., `image/jpeg`, `image/png`).
    3.  File Payload: Click "Choose File" and select your image file.
    4.  Click "Create Record".
*   **Adding a vCard record:**
    1.  Record Type: `MIME Type`
    2.  MIME Type: `text/vcard` (or `text/x-vcard`)
    3.  Text Payload for MIME type: Paste the full vCard text (starting with `BEGIN:VCARD` and ending with `END:VCARD`). Alternatively, you can upload a `.vcf` file using the File Payload option.
    4.  Click "Create Record".

### 5. Deleting Records
*   Each record in the list has a **Delete icon (X)** next to it.
*   Click this icon to remove the record from the current list. This only affects the list in the app; it does not modify the tag until you write.

### 6. Writing Records to a Tag
1.  Once you have the desired list of records (either from a scan, added manually, or a combination), click the **"Write to Tag"** button.
2.  If the estimated size of the NDEF message is large, a warning will appear, as it might not fit on smaller tags. You can choose to proceed.
3.  A status message "Writing to NFC Tag..." will appear. Tap an NFC tag to your device's NFC reader.
4.  The application will attempt to write the current list of records to the tag.
5.  An alert will confirm success or failure.

## Supported Record Types (for rich rendering and easy adding)

The application provides specific UI support and rich rendering for the following common NDEF record types:

*   **Text:** Plain text.
*   **URL:** Uniform Resource Locators (web links).
*   **Images:** Common formats like `image/png`, `image/jpeg`, `image/gif`, etc. (via MIME type).
*   **Videos:** Common formats like `image/mp4`, etc. (via MIME type).
*   **vCard:** Contact information (`text/vcard` or `text/x-vcard` MIME type).
*   **Other MIME types:** Generic handling for other MIME types using file uploads or text input, with fallback display.

## Technical Overview (Web NFC API)

This application primarily uses `NDEFReader` from the Web NFC API.

*   **Reading:** `ndef.scan()` initiates scanning, and `ndef.onreading` handles incoming NDEF messages.
*   **Writing:** `ndef.write()` sends an NDEF message (an array of `NDEFRecordInit` objects) to a tag.
*   **NDEF Records:** The structure and interpretation of `NDEFRecord` objects (properties like `recordType`, `mediaType`, `data`, `encoding`, `lang`, `id`) are central to handling NFC data.

The application internally manages `NDEFRecord` objects (typically when read from a tag) and prepares `NDEFRecordInit` objects (for writing to a tag), ensuring correct data types and encodings.

*(The previous README sections on "Using the Web NFC API" and "Understanding NDEF Records" contained examples that are still broadly relevant but might not exactly match the current, more advanced implementation details in `App.vue`. The core API usage remains similar.)*

## Development and Setup

### Recommended IDE Setup
*   [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) (ensure Vetur is disabled if previously installed).
*   Install the [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin) for full TypeScript support in `.vue` files.

### Project Setup
1.  Clone the repository:
    ```sh
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```
2.  Install dependencies:
    ```sh
    npm install
    ```

### Compile and Hot-Reload for Development
```sh
npm run dev
```
This will start a local development server. Open the provided URL in a Web NFC-compatible browser on your NFC-enabled device.

### Type-Check, Compile and Minify for Production
```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)
```sh
npm run lint
```

## License
This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
