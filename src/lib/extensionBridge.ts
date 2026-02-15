/**
 * Bridge for communicating with the VS Code extension host.
 * This branch (zypster) always runs inside a VS Code WebView.
 */

import type { PaperMetadata } from '@/types'

export interface AddReferencePayload {
  id: string
  title: string
  authors: string[]
  year: number
  doi?: string
  journal?: string
  volume?: string
  issue?: string
  firstPage?: string
  lastPage?: string
  type?: string
}

type MessageToExtension = { type: 'addReference'; paper: AddReferencePayload }

type MessageFromExtension =
  | { type: 'referenceAdded'; key: string }
  | { type: 'referenceError'; error: string }

const vscode = acquireVsCodeApi()

export function addReference(id: string, year: number, metadata: PaperMetadata): void {
  const paper: AddReferencePayload = {
    id,
    title: metadata.title,
    authors: metadata.authors,
    year,
    doi: metadata.doi,
    journal: metadata.sourceName,
    volume: metadata.volume,
    issue: metadata.issue,
    firstPage: metadata.firstPage,
    lastPage: metadata.lastPage,
    type: metadata.type,
  }
  // Deep-clone to strip Vue reactive proxies (not cloneable by postMessage)
  const msg: MessageToExtension = JSON.parse(JSON.stringify({ type: 'addReference', paper }))
  vscode.postMessage(msg)
}

export function onMessage(handler: (msg: MessageFromExtension) => void): void {
  window.addEventListener('message', (event) => {
    handler(event.data as MessageFromExtension)
  })
}
