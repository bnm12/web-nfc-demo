<script setup lang="ts">
/*global NDEFRecord*/
/*global NDEFRecordInit*/

import { ref } from "vue";
import { ChevronDownIcon, ChevronUpIcon, XCircleIcon } from "@heroicons/vue/solid";

const props = defineProps<{
  record: NDEFRecord;
  // No index needed if we rely on App.vue to know which record this is,
  // but if we pass index, delete can be more direct.
  // For now, App.vue will manage index.
}>();

const emit = defineEmits(['delete-record']);

const showDetails = ref(false);

const handleDelete = () => {
  emit('delete-record'); // App.vue will know which record to delete based on the component instance or index
}

function decodeRecord(record: NDEFRecord) {
  // Ensure record.data is not null or undefined before accessing its buffer
  if (!record.data) {
    return "No data in record";
  }
  const decoder = new TextDecoder(record.encoding ?? "utf-8");
  return decoder.decode(record.data.buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer, mediaType: string) {
  const byteArray = new Uint8Array(buffer);
  let binaryString = "";
  for (let i = 0; i < byteArray.byteLength; i++) {
    binaryString += String.fromCharCode(byteArray[i]);
  }
  const base64Data = btoa(binaryString);
  return `data:${mediaType};base64,${base64Data}`;
}

function arrayBufferToHexString(buffer: ArrayBuffer) {
  const byteArray = new Uint8Array(buffer);
  let hexString = "";
  for (let i = 0; i < byteArray.byteLength; i++) {
    hexString += byteArray[i].toString(16).padStart(2, "0");
  }
  return hexString;
}
</script>

<template>
  <div
    class="text-black dark:text-white flex flex-col p-2 border border-gray-200 dark:border-gray-700"
  >
    <div class="flex justify-between items-center mb-2">
      <div class="text-sm">
        <p class="font-semibold"><span title="NDEF Record Type (e.g., text, url, mime)">Type:</span></p>
        <p :title="`Record type: ${record.recordType}`">{{ record.recordType }}</p>
      </div>
      <div class="flex items-center space-x-2">
        <button @click="showDetails = !showDetails" class="p-1" title="Show/Hide detailed record information (ID, encoding, etc.)">
          <ChevronDownIcon v-if="!showDetails" class="w-6 h-6" />
          <ChevronUpIcon v-else class="w-6 h-6" />
        </button>
        <button @click="handleDelete" class="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-600" title="Delete this record from the list">
          <XCircleIcon class="w-6 h-6" />
        </button>
      </div>
    </div>

    <div v-if="showDetails" class="mb-2 text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <p class="font-semibold"><span title="Identifier for this NDEF record">Id:</span></p>
          <p :title="`Record ID: ${record.id ?? 'N/A'}`">{{ record.id ?? "N/A" }}</p>
        </div>
        <div>
          <p class="font-semibold"><span title="MIME type of the record payload (if applicable)">Mime/Media Type:</span></p>
          <p :title="`MIME type: ${record.mediaType ?? 'N/A'}`">{{ record.mediaType ?? "N/A" }}</p>
        </div>
        <div>
          <p class="font-semibold"><span title="Character encoding of the payload (if applicable)">Encoding:</span></p>
          <p :title="`Encoding: ${record.encoding ?? 'N/A'}`">{{ record.encoding ?? "N/A" }}</p>
        </div>
        <div>
          <p class="font-semibold"><span title="Language code of the payload (if applicable)">Language:</span></p>
          <p :title="`Language: ${record.lang ?? 'N/A'}`">{{ record.lang ?? "N/A" }}</p>
        </div>
      </div>
    </div>

    <div class="mt-1">
      <!-- URL Renderer -->
      <div v-if="record.recordType === 'url' || record.mediaType === 'text/uri'" title="Decoded URL payload">
        <p class="font-semibold">URL:</p>
        <a
          :href="decodeRecord(record)"
          target="_blank"
          class="text-blue-500 hover:underline break-all"
          title="Open link in a new tab"
        >
          {{ decodeRecord(record) }}
        </a>
      </div>

      <!-- Text Renderer -->
      <div v-else-if="record.recordType === 'text' || record.mediaType?.startsWith('text/plain')" title="Decoded text payload">
        <p class="font-semibold">Text:</p>
        <div class="whitespace-pre-wrap break-all">{{ decodeRecord(record) }}</div>
      </div>

      <!-- Image Renderer -->
      <div v-else-if="record.mediaType?.startsWith('image/')">
        <p class="font-semibold">Image Preview:</p>
        <img
          :src="arrayBufferToBase64(record.data!.buffer, record.mediaType!)"
          alt="NDEF Image Content"
          class="max-w-full h-auto border border-gray-300 dark:border-gray-600"
          title="Preview of the image content"
        />
      </div>

      <!-- Video Renderer -->
      <div v-else-if="record.mediaType?.startsWith('video/')">
        <p class="font-semibold">Video Preview:</p>
        <video
          :src="arrayBufferToBase64(record.data!.buffer, record.mediaType!)"
          controls
          class="max-w-full h-auto border border-gray-300 dark:border-gray-600"
          title="Preview of the video content"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <!-- VCard Renderer -->
      <div v-else-if="record.mediaType === 'text/vcard' || record.mediaType === 'text/x-vcard'" title="Parsed vCard contact information">
        <p class="font-semibold">VCard Data:</p>
        <ul class="list-disc pl-5 text-sm">
          <li v-for="(line, index) in decodeRecord(record).split('\\n')" :key="index" :title="`vCard line: ${line}`">
            <span class="font-medium">{{ line.substring(0, line.indexOf(':')) }}:</span>
            {{ line.substring(line.indexOf(':') + 1) }}
          </li>
        </ul>
      </div>

      <!-- Fallback for other types -->
      <div v-else title="Raw and attempted decoded payload for unknown record type">
        <p class="font-semibold">Unknown Record Type</p>
        <p class="text-sm">Record Type: <span class="font-mono" :title="`Raw record type: ${record.recordType}`">{{ record.recordType }}</span></p>
        <p class="text-sm">Media Type: <span class="font-mono" :title="`Raw media type: ${record.mediaType ?? 'N/A'}`">{{ record.mediaType ?? "N/A" }}</span></p>
        <p class="font-semibold mt-2">Raw Data (Hex):</p>
        <div class="whitespace-pre-wrap break-all text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded" :title="`Hexadecimal representation of the payload: ${record.data ? arrayBufferToHexString(record.data.buffer) : 'No data'}`">
          {{ record.data ? arrayBufferToHexString(record.data.buffer) : "No data" }}
        </div>
        <p class="font-semibold mt-2">Decoded Text (Attempt):</p>
        <div class="whitespace-pre-wrap break-all text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded" :title="`Attempted text decoding of the payload: ${decodeRecord(record)}`">
          {{ decodeRecord(record) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style></style>
