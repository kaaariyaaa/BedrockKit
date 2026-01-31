import {
  BoxRenderable,
  createCliRenderer,
  InputRenderable,
  InputRenderableEvents,
  SelectRenderable,
  SelectRenderableEvents,
  StyledText,
  TextRenderable,
  fg,
  type KeyEvent,
} from "@opentui/core";
import figlet from "figlet";

type CancelSymbol = typeof CANCEL;

export type SelectOption<T = string> = {
  value: T;
  label: string;
  hint?: string;
};

export type SelectOptions<T = string> = {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
};

export type MultiSelectOptions<T = string> = {
  message: string;
  options: SelectOption<T>[];
  initialValues?: T[];
};

export type TextOptions = {
  message: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
  placeholder?: string;
};

export type ConfirmOptions = {
  message: string;
  initialValue?: boolean;
};

const CANCEL = Symbol("prompt.cancel");

export function isCancel(value: unknown): value is CancelSymbol {
  return value === CANCEL;
}

function getUiLang(): "ja" | "en" {
  const env = process.env.BKIT_LANG?.toLowerCase();
  return env === "en" ? "en" : "ja";
}

function uiText(lang: "ja" | "en") {
  if (lang === "en") {
    return {
      title: "BedrockKit",
      helpSelect: "↑↓ to move / Enter to select / Esc to cancel",
      helpMulti: "↑↓ to move / Space to toggle / Enter to confirm / Esc to cancel",
      helpInput: "Enter to submit / Esc to cancel",
      yes: "Yes",
      no: "No",
      errorPrefix: "Error: ",
    } as const;
  }
  return {
    title: "BedrockKit",
    helpSelect: "↑↓で選択 / Enterで決定 / Escでキャンセル",
    helpMulti: "↑↓で選択 / Spaceで切替 / Enterで確定 / Escでキャンセル",
    helpInput: "Enterで確定 / Escでキャンセル",
    yes: "はい",
    no: "いいえ",
    errorPrefix: "エラー: ",
  } as const;
}

async function withRenderer<T>(fn: (renderer: Awaited<ReturnType<typeof createCliRenderer>>) => Promise<T>): Promise<T> {
  const renderer = await createCliRenderer({
    useAlternateScreen: true,
    exitOnCtrlC: false,
    useConsole: false,
  });
  try {
    return await fn(renderer);
  } finally {
    renderer.destroy();
  }
}

function setupLayout(renderer: Awaited<ReturnType<typeof createCliRenderer>>, message: string) {
  const lang = getUiLang();
  const text = uiText(lang);
  const banner = buildBedrockBanner("BEDROCKKIT");

  const container = new BoxRenderable(renderer, {
    id: "prompt-root",
    width: "100%",
    height: "100%",
    border: true,
    borderStyle: "rounded",
    padding: 1,
    flexDirection: "column",
    gap: 1,
  });

  const title = new TextRenderable(renderer, {
    id: "prompt-title",
    content: banner,
    wrapMode: "none",
  });

  const msg = new TextRenderable(renderer, {
    id: "prompt-message",
    content: message,
  });

  const body = new BoxRenderable(renderer, {
    id: "prompt-body",
    width: "100%",
    flexGrow: 1,
    flexDirection: "column",
    gap: 1,
  });

  const footer = new TextRenderable(renderer, {
    id: "prompt-footer",
    content: "",
    fg: "#9aa5ce",
  });

  container.add(title);
  container.add(msg);
  container.add(body);
  container.add(footer);
  renderer.root.add(container);

  return { container, body, footer, text };
}

function buildBedrockBanner(label: string): StyledText {
  const palette = [
    "#1f1f1f",
    "#2b2b2b",
    "#3a3a3a",
    "#4a4a4a",
    "#5a5a5a",
    "#6b6b6b",
    "#7a7a7a",
  ];

  const rendered = figlet.textSync(label, {
    font: "Tinker-Toy",
    horizontalLayout: "default",
    verticalLayout: "default",
  });
  const artLines = rendered.split(/\r?\n/).filter((line) => line.length > 0);

  const chunks: StyledText["chunks"] = [];
  for (let row = 0; row < artLines.length; row += 1) {
    const line = artLines[row]!;
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col] ?? " ";
      const idx = (row * 131 + col * 17) % palette.length;
      const color = palette[idx]!;
      chunks.push(fg(color)(ch));
    }
    if (row < artLines.length - 1) {
      chunks.push(fg(palette[row % palette.length]!)("\n"));
    }
  }

  return new StyledText(chunks);
}

function fallbackSelect<T>(options: SelectOption<T>[], initialValue?: T): T | CancelSymbol {
  if (!options.length) return CANCEL;
  if (initialValue !== undefined) {
    const found = options.find((opt) => opt.value === initialValue);
    if (found) return found.value;
  }
  return options[0]!.value;
}

export async function select<T = string>(opts: SelectOptions<T>): Promise<T | CancelSymbol> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return fallbackSelect(opts.options, opts.initialValue);
  }
  return withRenderer(async (renderer) => {
    const { body, footer, text } = setupLayout(renderer, opts.message);
    footer.content = text.helpSelect;

    const selectBox = new SelectRenderable(renderer, {
      id: "prompt-select",
      width: "100%",
      height: "100%",
      options: opts.options.map((opt) => ({
        name: opt.label,
        description: opt.hint ?? "",
        value: opt.value,
      })),
    });

    const initialIndex = opts.initialValue === undefined
      ? 0
      : Math.max(0, opts.options.findIndex((opt) => opt.value === opts.initialValue));
    selectBox.setSelectedIndex(initialIndex);

    body.add(selectBox);
    selectBox.focus();

    let resolved = false;

    return new Promise<T | CancelSymbol>((resolve) => {
      const finish = (value: T | CancelSymbol) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      const onKey = (key: KeyEvent) => {
        if (key.name === "escape" || (key.ctrl && key.name === "c")) {
          finish(CANCEL);
        }
      };

      renderer.keyInput.on("keypress", onKey);
      selectBox.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: { value?: T } | null) => {
        finish(option?.value ?? opts.options[selectBox.getSelectedIndex()]!.value);
      });
    });
  });
}

function formatMultiOptions<T>(options: SelectOption<T>[], selected: Set<T>) {
  return options.map((opt) => {
    const mark = selected.has(opt.value) ? "[x]" : "[ ]";
    return {
      name: `${mark} ${opt.label}`,
      description: opt.hint ?? "",
      value: opt.value,
    };
  });
}

export async function multiselect<T = string>(opts: MultiSelectOptions<T>): Promise<T[] | CancelSymbol> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    if (!opts.options.length) return CANCEL;
    return opts.initialValues ? [...opts.initialValues] : [];
  }

  return withRenderer(async (renderer) => {
    const { body, footer, text } = setupLayout(renderer, opts.message);
    footer.content = text.helpMulti;

    const selected = new Set<T>(opts.initialValues ?? []);

    const selectBox = new SelectRenderable(renderer, {
      id: "prompt-multiselect",
      width: "100%",
      height: "100%",
      options: formatMultiOptions(opts.options, selected),
      showDescription: true,
    });

    body.add(selectBox);
    selectBox.focus();

    let resolved = false;

    return new Promise<T[] | CancelSymbol>((resolve) => {
      const finish = (value: T[] | CancelSymbol) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      const onKey = (key: KeyEvent) => {
        if (key.name === "escape" || (key.ctrl && key.name === "c")) {
          finish(CANCEL);
          return;
        }
        if (key.name === "space") {
          const index = selectBox.getSelectedIndex();
          const current = opts.options[index];
          if (!current) return;
          if (selected.has(current.value)) {
            selected.delete(current.value);
          } else {
            selected.add(current.value);
          }
          const nextIndex = selectBox.getSelectedIndex();
          selectBox.options = formatMultiOptions(opts.options, selected);
          selectBox.setSelectedIndex(nextIndex);
          return;
        }
        if (key.name === "enter" || key.name === "return") {
          finish([...selected]);
        }
      };

      renderer.keyInput.on("keypress", onKey);
    });
  });
}

export async function text(opts: TextOptions): Promise<string | CancelSymbol> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return opts.initialValue ?? "";
  }

  return withRenderer(async (renderer) => {
    const { body, footer, text: textUi } = setupLayout(renderer, opts.message);
    footer.content = textUi.helpInput;

    const inputBox = new BoxRenderable(renderer, {
      id: "prompt-input-box",
      width: "100%",
      border: true,
      borderStyle: "single",
      padding: 1,
      flexDirection: "column",
      gap: 1,
    });

    const input = new InputRenderable(renderer, {
      id: "prompt-input",
      width: "100%",
      value: opts.initialValue ?? "",
      placeholder: opts.placeholder,
    });

    const errorText = new TextRenderable(renderer, {
      id: "prompt-error",
      content: "",
      fg: "#f7768e",
    });

    inputBox.add(input);
    inputBox.add(errorText);
    body.add(inputBox);

    input.focus();

    let resolved = false;

    return new Promise<string | CancelSymbol>((resolve) => {
      const finish = (value: string | CancelSymbol) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      const onKey = (key: KeyEvent) => {
        if (key.name === "escape" || (key.ctrl && key.name === "c")) {
          finish(CANCEL);
        }
      };

      renderer.keyInput.on("keypress", onKey);

      input.on(InputRenderableEvents.ENTER, () => {
        const value = input.value ?? "";
        const message = opts.validate ? opts.validate(String(value)) : undefined;
        if (message) {
          errorText.content = `${textUi.errorPrefix}${message}`;
          return;
        }
        finish(String(value));
      });

      input.on(InputRenderableEvents.CHANGE, () => {
        if (errorText.content) {
          errorText.content = "";
        }
      });
    });
  });
}

export async function confirm(opts: ConfirmOptions): Promise<boolean | CancelSymbol> {
  const lang = getUiLang();
  const textUi = uiText(lang);
  const options: SelectOption<boolean>[] = [
    { value: true, label: textUi.yes },
    { value: false, label: textUi.no },
  ];
  const choice = await select({
    message: opts.message,
    options,
    initialValue: opts.initialValue ?? true,
  });
  if (isCancel(choice)) return choice;
  return !!choice;
}

export function intro(message: string): void {
  console.log(message);
}

export function outro(message: string): void {
  console.log(message);
}

export function spinner() {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentMessage = "";
  let idx = 0;

  const start = (message: string) => {
    currentMessage = message;
    if (!process.stdout.isTTY) {
      console.log(message);
      return;
    }
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const frame = frames[idx % frames.length];
      idx += 1;
      process.stdout.write(`\r${frame} ${currentMessage}`);
    }, 80);
  };

  const stop = (message?: string) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (process.stdout.isTTY) {
      const finalMessage = message ?? currentMessage;
      process.stdout.write(`\r✔ ${finalMessage}\n`);
    } else if (message) {
      console.log(message);
    }
  };

  return { start, stop };
}

export const log = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
};
