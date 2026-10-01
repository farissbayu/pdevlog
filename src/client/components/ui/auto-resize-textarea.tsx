import { useLayoutEffect, useRef, type ComponentProps } from "react"
import { cn } from "cn"

import { Textarea } from "@/client/components/ui/textarea"

const MIRROR_STYLE_PROPERTIES = [
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textAlign",
  "textTransform",
  "textIndent",
  "tabSize",
  "overflowWrap",
  "wordBreak",
] as const

function getCaretViewportTop(
  textarea: HTMLTextAreaElement,
  index: number,
): number {
  const computed = window.getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()
  const mirror = document.createElement("div")
  const style = mirror.style

  style.position = "absolute"
  style.top = `${rect.top + window.scrollY}px`
  style.left = `${rect.left + window.scrollX}px`
  style.width = `${rect.width}px`
  style.boxSizing = "border-box"
  style.whiteSpace = "pre-wrap"
  style.overflow = "hidden"
  style.margin = "0"
  style.visibility = "hidden"
  style.pointerEvents = "none"

  for (const property of MIRROR_STYLE_PROPERTIES) {
    style[property] = computed[property]
  }

  mirror.textContent = textarea.value.slice(0, index)

  const marker = document.createElement("span")
  marker.textContent = textarea.value.slice(index) || "."
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const top = marker.getBoundingClientRect().top
  document.body.removeChild(mirror)

  return top
}

function AutoResizeTextarea({
  className,
  value,
  ...props
}: ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`

    if (document.activeElement !== element) {
      return
    }

    const lineHeight =
      Number.parseFloat(window.getComputedStyle(element).lineHeight) || 24
    const caretTop = getCaretViewportTop(element, element.selectionStart ?? 0)
    const caretBottom = caretTop + lineHeight
    const bottomBoundary = window.innerHeight - lineHeight * 2

    if (caretBottom > bottomBoundary) {
      window.scrollBy({ top: caretBottom - bottomBoundary, behavior: "auto" })
    }
  }, [value])

  return (
    <Textarea
      ref={ref}
      value={value}
      className={cn("resize-none overflow-hidden", className)}
      {...props}
    />
  )
}

export { AutoResizeTextarea }
