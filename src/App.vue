<script setup lang="ts">
/*global NDEFRecord*/ // Still needed for ScannedTag.records type if NDEFRecord is not globally typed via tsconfig

import NDEFRecordVue from "./components/NDEFRecord.vue";
import AddRecordForm from "./components/AddRecordForm.vue";
import SpinnerIcon from "./assets/SpinnerIcon.vue";
import PauseIcon from "./assets/PauseIcon.vue";

import { ref } from "vue";
import type { Ref } from "vue";

// Import types from the new central types file
import type { NDEFRecordInitCustom, NFCStatus, ScannedTag } from './@types/app';

// Import services
import { 
  readNFC as nfcReadService, 
  writeNFC as nfcWriteService, 
  cancelScan as nfcCancelScanService 
} from './services/nfcService';
import { 
  handleAddRecord as recordAddService, 
  handleDeleteRecord as recordDeleteService 
} from './services/recordService';
// nfcUtils are used by services, not directly by App.vue typically

// --- Reactive State ---
const scanAbortController = ref<AbortController | null>(null);
const continuousScan = ref(true); 
const scannedTag: Ref<ScannedTag> = ref({ uuid: "", records: [] as NDEFRecord[] }); // NDEFRecord[] type
const status: Ref<NFCStatus> = ref({ writing: false, reading: false });
const showAddForm = ref(false); 

// --- Service Wrappers / UI Logic ---

// Wrapper function for calling the readNFC service
async function callReadNFC() {
  // Pass all required reactive dependencies to the service function
  await nfcReadService(status, scannedTag, continuousScan, scanAbortController);
}

// Wrapper function for calling the writeNFC service
async function callWriteNFC() {
  // Pass the records from the scannedTag ref and the status ref
  await nfcWriteService(scannedTag.value.records, status);
}

// Wrapper function for calling the cancelScan service
function callCancelScan() {
  nfcCancelScanService(scanAbortController);
}

// Wrapper function for calling the handleAddRecord service
function callHandleAddRecord(recordInit: NDEFRecordInitCustom) {
  // Pass necessary refs to the service
  recordAddService(recordInit, scannedTag, showAddForm);
}

// Wrapper function for calling the handleDeleteRecord service
function callHandleDeleteRecord(index: number) {
  recordDeleteService(index, scannedTag);
}

// UI-specific logic that remains in the component
function handleCancelAddRecord() {
  showAddForm.value = false;
}

</script>

<template>
  <div class="flex flex-col p-4 space-y-4 bg-gray-100 dark:bg-gray-900 min-h-screen">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">NFC Tag Editor</h1>
    </header>

    <div class="controls-section flex flex-col sm:flex-row gap-2 mb-4">
      <button
        @click="callReadNFC"
        :disabled="status.reading"
        :class="[
          'w-full sm:w-auto flex-1 text-white font-bold py-3 px-6 rounded-md shadow-sm flex items-center justify-center transition-colors duration-150',
          status.reading && !status.writing ? 'bg-blue-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-700',
          status.reading ? 'disabled:bg-blue-400 dark:disabled:bg-blue-700' : 'disabled:bg-gray-400 dark:disabled:bg-gray-600'
        ]"
        title="Scan for nearby NFC tags"
      >
        <SpinnerIcon
          v-if="status.reading && !status.writing"
          class="w-5 h-5 mr-2 text-gray-200 animate-spin dark:text-gray-100 fill-white"
        />
        <PauseIcon
          v-if="status.reading && status.writing"
          class="w-5 h-5 mr-2 text-gray-200 dark:text-gray-100 fill-gray-700 dark:fill-gray-300"
        />
        {{ status.reading ? (continuousScan ? 'Scanning (continuous)...' : 'Scanning (once)...') : 'Scan Tag' }}
      </button>
      <button
        @click="callCancelScan"
        v-if="status.reading && !status.writing"
        class="w-full sm:w-auto flex-1 bg-red-500 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md shadow-sm flex items-center justify-center transition-colors duration-150"
        title="Cancel the ongoing NFC scan"
      >
        Cancel Scan
      </button>
      <button
        @click="callWriteNFC" 
        :disabled="!scannedTag.records.length || status.writing || status.reading"
        :class="[
          'w-full sm:w-auto flex-1 text-white font-bold py-3 px-6 rounded-md shadow-sm flex items-center justify-center transition-colors duration-150',
          status.writing ? 'bg-green-600 animate-pulse' : 'bg-green-500 hover:bg-green-700',
          status.writing ? 'disabled:bg-green-400 dark:disabled:bg-green-700' : 'disabled:bg-gray-400 dark:disabled:bg-gray-600'
        ]"
        :title="!scannedTag.records.length ? 'Add records first before writing' : 'Write the current list of records to an NFC tag'"
      >
        <SpinnerIcon
          v-if="status.writing"
          class="w-5 h-5 mr-2 text-gray-200 animate-spin dark:text-gray-100 fill-white"
        />
        {{ status.writing ? 'Writing...' : 'Write to Tag' }}
      </button>
    </div>

    <!-- Global Status Indicator -->
    <div v-if="status.reading && !status.writing" class="p-4 mb-4 text-center text-blue-700 bg-blue-100 dark:bg-blue-700 dark:text-blue-100 rounded-lg shadow-md flex items-center justify-center">
      <SpinnerIcon class="w-6 h-6 mr-3 animate-spin fill-blue-500 dark:fill-blue-300" />
      <p class="font-semibold">Scanning for NFC Tag... Please tap a tag to your device.</p>
    </div>
    <div v-if="status.writing" class="p-4 mb-4 text-center text-green-700 bg-green-100 dark:bg-green-700 dark:text-green-100 rounded-lg shadow-md flex items-center justify-center">
      <SpinnerIcon class="w-6 h-6 mr-3 animate-pulse fill-green-500 dark:fill-green-300" />
      <p class="font-semibold">Writing to NFC Tag... Keep the tag in place.</p>
    </div>

    <div class="add-record-section mb-4">
      <button
        @click="showAddForm = !showAddForm"
        class="w-full bg-purple-500 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md shadow-sm"
        :title="showAddForm ? 'Close the form for adding a new record' : 'Open form to add a new NDEF record'"
      >
        {{ showAddForm ? 'Cancel Adding Record' : 'Add New Record' }}
      </button>
      <AddRecordForm
        v-if="showAddForm"
        @add-record="callHandleAddRecord" 
        @cancel="handleCancelAddRecord"
        class="mt-4 p-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg"
      />
    </div>

    <div class="controls-section flex items-center gap-2 mb-4">
      <input
        type="checkbox"
        id="continuousScanCheckbox"
        v-model="continuousScan"
        :disabled="status.reading"
        class="form-checkbox h-6 w-6 text-indigo-600 dark:text-indigo-400 bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-indigo-300"
      />
      <label for="continuousScanCheckbox" class="p-1 text-base font-medium text-gray-700 dark:text-gray-300">Continuous Scanning</label>
    </div>
    
    <div v-if="scannedTag.uuid || scannedTag.records.length > 0" class="records-display bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
      <h3
        v-if="scannedTag.uuid"
        class="text-black dark:text-white text-lg mb-4 text-center font-semibold"
      >
        <span title="Unique Identifier of the scanned NFC tag">Tag UID:</span> <span class="font-mono">{{ scannedTag.uuid.toUpperCase() }}</span>
      </h3>
      
      <div v-if="scannedTag.records.length === 0 && !showAddForm" class="text-center text-gray-500 dark:text-gray-400 py-4">
        <p>No records on this tag, or no records added yet.</p>
        <p>Click "Add New Record" to create one.</p>
      </div>

      <div class="space-y-3">
        <NDEFRecordVue
          v-for="(record, index) in scannedTag.records"
          :key="index" 
          :record="record"
          @delete-record="callHandleDeleteRecord(index)" 
          class="mb-1 border border-gray-200 dark:border-gray-700 rounded-md"
        />
      </div>
    </div>
    <div v-else-if="!status.reading && !status.writing && !showAddForm" class="text-center text-gray-500 dark:text-gray-400 py-10">
        <p>Click "Scan Tag" to read an NFC tag, or "Add New Record" to start creating records.</p>
    </div>

  </div>
</template>

<style>
body {
  font-family: 'Inter', sans-serif; 
}
</style>
