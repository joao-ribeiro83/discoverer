import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PdfExportRequest } from '@/lib/types'

const PAGE_SIZES: NonNullable<PdfExportRequest['pageSize']>[] = ['A4', 'A3', 'LETTER']

interface PdfExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The executed result's columns, in display order. */
  columns: Array<{ name: string; label: string }>
  onConfirm: (request: PdfExportRequest) => void
}

/**
 * What Discoverer's print dialog asked before a PDF: paper, orientation, and
 * which columns go on the page. The map description is always printed at the
 * top of the first page, so it is not an option here.
 */
export function PdfExportDialog({ open, onOpenChange, columns, onConfirm }: PdfExportDialogProps) {
  const { t } = useTranslation(['mapViewer', 'common'])
  const [pageSize, setPageSize] = useState<NonNullable<PdfExportRequest['pageSize']>>('A4')
  const [orientation, setOrientation] =
    useState<NonNullable<PdfExportRequest['orientation']>>('PORTRAIT')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Every column starts selected each time the dialog opens.
  useEffect(() => {
    if (open) setSelected(new Set(columns.map((c) => c.name)))
  }, [open, columns])

  function toggle(name: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(name)
      else next.delete(name)
      return next
    })
  }

  const allSelected = selected.size === columns.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('mapViewer:export.pdfDialog.title')}</DialogTitle>
          <DialogDescription>{t('mapViewer:export.pdfDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-page-size">{t('mapViewer:export.pdfDialog.pageSize')}</Label>
            <Select value={pageSize} onValueChange={(v) => setPageSize(v as typeof pageSize)}>
              <SelectTrigger id="pdf-page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {t(`mapViewer:export.pdfDialog.sizes.${size}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdf-orientation">{t('mapViewer:export.pdfDialog.orientation')}</Label>
            <Select
              value={orientation}
              onValueChange={(v) => setOrientation(v as typeof orientation)}
            >
              <SelectTrigger id="pdf-orientation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PORTRAIT">{t('mapViewer:export.pdfDialog.portrait')}</SelectItem>
                <SelectItem value="LANDSCAPE">{t('mapViewer:export.pdfDialog.landscape')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('mapViewer:export.pdfDialog.columns', { count: selected.size })}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(columns.map((c) => c.name)))
              }
            >
              {allSelected
                ? t('mapViewer:export.pdfDialog.selectNone')
                : t('mapViewer:export.pdfDialog.selectAll')}
            </Button>
          </div>
          <ul className="max-h-[40vh] divide-y overflow-y-auto rounded-md border">
            {columns.map((c) => (
              <li key={c.name} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <Checkbox
                  id={`pdf-col-${c.name}`}
                  checked={selected.has(c.name)}
                  onCheckedChange={(v) => toggle(c.name, v === true)}
                />
                <Label htmlFor={`pdf-col-${c.name}`} className="cursor-pointer font-normal">
                  {c.label}
                </Label>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0}
            onClick={() => {
              onConfirm({
                pageSize,
                orientation,
                // Omitted when everything is selected: the server prints all.
                columns: allSelected ? undefined : columns.filter((c) => selected.has(c.name)).map((c) => c.name),
              })
              onOpenChange(false)
            }}
          >
            {t('mapViewer:export.pdfDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
