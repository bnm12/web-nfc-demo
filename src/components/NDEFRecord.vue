<script setup lang="ts">
/*global NDEFRecord*/ // For the record prop type

import { ref } from "vue";
import { ChevronDownIcon, ChevronUpIcon, XCircleIcon } from "@heroicons/vue/solid";
// Import utility functions
import { 
  decodeRecord, 
  arrayBufferToBase64, 
  arrayBufferToHexString 
} from "../utils/nfcUtils"; // Corrected path

const props = defineProps<{
  record: NDEFRecord; 
}>();

const emit = defineEmits(['delete-record']);

const showDetails = ref(false);

const handleDelete = () => {
  emit('delete-record'); 
}

// Utility functions are now imported, local definitions are removed.
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
        <button @click="showDetails = !showDetails" class="p-2" title="Show/Hide detailed record information (ID, encoding, etc.)">
          <ChevronDownIcon v-if="!showDetails" class="w-6 h-6" />
          <ChevronUpIcon v-else class="w-6 h-6" />
        </button>
        <button @click="handleDelete" class="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-600" title="Delete this record from the list">
          <XCircleIcon class="w-6 h-6" />
        </button>
      </div>
    </div>

    <div v-if="showDetails" class="mb-2 text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          <!-- Basic vCard parsing: split lines, then split by the first colon -->
          <li v-for="(line, index) in decodeRecord(record).split(/\\r\\n|\\n|\\r/)" :key="index" :title="`vCard line: ${line}`">
            <template v-if="line.includes(':')">
              <span class="font-medium">{{ line.substring(0, line.indexOf(':')) }}:</span>
              {{ line.substring(line.indexOf(':') + 1) }}
            </template>
            <template v-else>
              {{ line }}
            </template>
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
