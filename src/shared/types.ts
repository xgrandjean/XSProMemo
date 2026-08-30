export type Orientation = 'portrait' | 'paysage'

/**
 * A content file attached to a chapter, or used as a cover page. Always a .docx: the
 * document is assembled as one Word file, so mixing formats would defeat the point.
 * The file holds content only — chapter titles are added by the application.
 */
export interface ContentRef {
  file: string // relative to libraryPath
  originalName: string
}

export interface ChapterNode {
  id: string
  title: string
  pageBreakBefore: boolean
  orientation: Orientation
  content: ContentRef | null // null = heading only, no content of its own
  children: ChapterNode[]
}

/** One mémoire = one document being built. It owns its whole plan directly. */
export interface Memoire {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  coverPages: ContentRef[] // first, unnumbered, absent from the table of contents
  chapters: ChapterNode[]
  lastGeneratedAt: string | null
  outputDocx: string | null
  outputPdf: string | null
}

export interface MemoireSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  lastGeneratedAt: string | null
}

/** The frozen part, edited behind the configuration screen. */
export interface ModelConfig {
  /** The Word template: styles, header with the logo, footer, margins. No content. */
  templatePath: string | null
  sommaireTitle: string
  exampleId: string | null
}

export interface GenerationProgressEvent {
  memoireId: string
  message: string
}

export interface GenerationResult {
  docxPath: string
  pdfPath: string
  pageCount: number
  warnings: string[]
}

export interface AppConfig {
  libraryPath: string | null
}
