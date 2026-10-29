"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CalculatorEngine } from "@openmirai/calculator-core/engine";
import { Calculator, FunctionSquare } from "lucide-react";
import { MathJax } from "better-react-mathjax";
import { FloatingToolWindow } from "@/components/floating-tool-window";
import { assessmentButton } from "@/components/assessment-controls";

type Calculation = { expression: string; result: string };
type DesmosColumn = { latex: string; values: string[] };
type DesmosTableRequest = { id: number; columns: DesmosColumn[] };
type DesmosCalculatorInstance = {
  setExpression: (expression: {
    id: string;
    type: "table";
    columns: DesmosColumn[];
  }) => void;
  destroy: () => void;
};
type DesmosApi = {
  GraphingCalculator: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => DesmosCalculatorInstance;
};
type CalculatorState = {
  expression: string;
  result: string;
  history: Calculation[];
};
type Tools = {
  openTool: (tool: "calculator" | "desmos") => void;
  tableRequest: DesmosTableRequest | null;
  calculation: CalculatorState;
  setExpression: (value: string) => void;
  calculate: () => void;
  clear: () => void;
  error: string;
};
const ToolsContext = createContext<Tools | null>(null);
const KEY = "sat-calculator-v1";
const DESMOS_API_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY || "";
let desmosApiPromise: Promise<DesmosApi> | null = null;
function loadDesmosApi(): Promise<DesmosApi> {
  if (!DESMOS_API_KEY) return Promise.reject(new Error("Desmos API key is missing."));
  const desmosWindow = window as Window & { Desmos?: DesmosApi };
  if (desmosWindow.Desmos) return Promise.resolve(desmosWindow.Desmos);
  if (desmosApiPromise) return desmosApiPromise;
  desmosApiPromise = new Promise<DesmosApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(DESMOS_API_KEY)}`;
    script.async = true;
    script.onload = () => {
      if (desmosWindow.Desmos) resolve(desmosWindow.Desmos);
      else reject(new Error("Desmos did not initialize."));
    };
    script.onerror = () => reject(new Error("Desmos could not be loaded."));
    document.head.appendChild(script);
  }).catch((error) => {
    desmosApiPromise = null;
    throw error;
  });
  return desmosApiPromise;
}
function DesmosCalculator({
  className,
  tableRequest,
  title,
}: {
  className: string;
  tableRequest: DesmosTableRequest | null;
  title: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const calculator = useRef<DesmosCalculatorInstance | null>(null);
  const latestRequest = useRef(tableRequest);
  const lastApplied = useRef(0);
  latestRequest.current = tableRequest;
  useEffect(() => {
    let cancelled = false;
    void loadDesmosApi()
      .then((api) => {
        if (cancelled || !container.current) return;
        const instance = api.GraphingCalculator(container.current, {
          degreeMode: true,
          restrictedFunctions: true,
          pasteTableData: true,
        });
        calculator.current = instance;
        const request = latestRequest.current;
        if (request) {
          instance.setExpression({
            id: `sat-table-${request.id}`,
            type: "table",
            columns: request.columns,
          });
          lastApplied.current = request.id;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      calculator.current?.destroy();
      calculator.current = null;
    };
  }, []);
  useEffect(() => {
    if (!tableRequest || tableRequest.id === lastApplied.current) return;
    calculator.current?.setExpression({
      id: `sat-table-${tableRequest.id}`,
      type: "table",
      columns: tableRequest.columns,
    });
    lastApplied.current = tableRequest.id;
  }, [tableRequest]);
  return <div ref={container} className={className} aria-label={title} />;
}
const initial: CalculatorState = { expression: "", result: "", history: [] };
const engineExpression = (value: string) =>
  value
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3");
function visualExpression(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "√" && value[i + 1] === "(") {
      let depth = 1,
        end = i + 2;
      while (end < value.length && depth) {
        if (value[end] === "(") depth++;
        if (value[end] === ")") depth--;
        end++;
      }
      result += `\\sqrt{${visualExpression(value.slice(i + 2, depth ? end : end - 1))}}`;
      i = end - 1;
    } else result += value[i];
  }
  return result
    .replace(/abs\(([^()]*)\)/g, "\\left|$1\\right|")
    .replace(/π/g, "\\pi ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/²/g, "^{2}")
    .replace(/³/g, "^{3}")
    .replace(/\^(\d+)/g, "^{$1}")
    .replace(/%/g, "\\%")
    .replace(/mod/g, "\\operatorname{mod}");
}
export function AssessmentToolsProvider({ children }: { children: ReactNode }) {
  const [calculation, setCalculation] = useState(initial);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [windows, setWindows] = useState({ calculator: false, desmos: false });
  const [tableRequest, setTableRequest] = useState<DesmosTableRequest | null>(null);
  const tableRequestId = useRef(0);
  const [activeTool, setActiveTool] = useState<"calculator" | "desmos">(
    "calculator",
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.expression === "string" && Array.isArray(data.history))
          setCalculation(data);
      }
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(KEY, JSON.stringify(calculation));
      } catch {}
  }, [calculation, hydrated]);
  useEffect(() => {
    const openDesmos = (event: Event) => {
      const columns = (event as CustomEvent<{ columns?: DesmosColumn[] }>)
        .detail?.columns;
      if (columns?.length) {
        tableRequestId.current += 1;
        setTableRequest({ id: tableRequestId.current, columns });
      }
      setActiveTool("desmos");
      const visiblePanel = document.querySelector(
        '[data-assessment-math-panel="visible"]',
      );
      if (!visiblePanel) setWindows((old) => ({ ...old, desmos: true }));
    };
    window.addEventListener("sat-open-desmos", openDesmos);
    return () => window.removeEventListener("sat-open-desmos", openDesmos);
  }, []);
  const setExpression = (value: string) => {
    setCalculation((old) => ({
      ...old,
      expression: value.replace(/sqrt\(/gi, "√(").replace(/\bpi\b/g, "π"),
    }));
    setError("");
  };
  const calculate = () => {
    if (!calculation.expression.trim()) return;
    try {
      const engine = new CalculatorEngine({ angleMode: "degrees" });
      const result = engine.format(
        engine.evaluate(engineExpression(calculation.expression)),
        { notation: "auto", significantFigures: 12 },
      );
      setCalculation((old) => ({
        ...old,
        result,
        history: [{ expression: old.expression, result }, ...old.history].slice(
          0,
          40,
        ),
      }));
      setError("");
    } catch {
      setError("Check the expression and try again.");
    }
  };
  return (
    <ToolsContext.Provider
      value={{
        openTool: (tool) => {
          setActiveTool(tool);
          setWindows((old) => ({ ...old, [tool]: true }));
        },
        tableRequest,
        calculation,
        setExpression,
        calculate,
        clear: () => {
          setCalculation((old) => ({ ...old, expression: "", result: "" }));
          setError("");
        },
        error,
      }}
    >
      {children}
      <FloatingToolWindow
        title="Calculator"
        open={windows.calculator}
        active={activeTool === "calculator"}
        onActivate={() => setActiveTool("calculator")}
        onClose={() => setWindows((old) => ({ ...old, calculator: false }))}
      >
        <ScientificCalculator />
      </FloatingToolWindow>
      <FloatingToolWindow
        title="Desmos"
        open={windows.desmos}
        active={activeTool === "desmos"}
        onActivate={() => setActiveTool("desmos")}
        onClose={() => setWindows((old) => ({ ...old, desmos: false }))}
        wide
      >
        {DESMOS_API_KEY ? (
          <DesmosCalculator
            title="Desmos graphing calculator window"
            className="h-full min-h-[300px] w-full"
            tableRequest={tableRequest}
          />
        ) : (
          <iframe
            title="Desmos graphing calculator window"
            src="https://www.desmos.com/testing/cb-sat-ap/graphing"
            className="h-full min-h-[300px] w-full border-0"
          />
        )}
      </FloatingToolWindow>
    </ToolsContext.Provider>
  );
}
export function ScientificCalculator() {
  const tools = useContext(ToolsContext);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  if (!tools) return null;
  const { calculation, setExpression, calculate, clear, error } = tools;
  const tokens: Record<string, string> = {
    "x²": "²",
    xʸ: "^",
    "√": "√(",
    mod: "mod(",
    "|x|": "abs(",
    ANS: calculation.result,
  };
  const keys = [
    "7",
    "8",
    "9",
    "÷",
    "(",
    ")",
    "4",
    "5",
    "6",
    "×",
    "x²",
    "xʸ",
    "1",
    "2",
    "3",
    "−",
    "√",
    "mod",
    "0",
    ".",
    "π",
    "+",
    "%",
    ",",
    "e",
    "|x|",
    "ANS",
    "⌫",
    "C",
    "=",
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
        <div
          className="min-h-8 overflow-auto text-right text-lg"
          aria-label="Formatted calculation"
        >
          <MathJax
            inline
            dynamic
          >{`\\(${visualExpression(calculation.expression) || "0"}\\)`}</MathJax>
        </div>
        <input
          id={`assessment-calculator-expression-${inputId}`}
          ref={input}
          aria-label="Calculator expression"
          value={calculation.expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              calculate();
            }
          }}
          placeholder="Enter a calculation"
          className="mt-2 w-full bg-transparent text-right font-mono text-lg outline-none"
        />
        <div role="status" className="mt-2 min-h-6 text-right font-mono">
          {error || calculation.result}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {keys.map((key) => (
          <button
            key={key}
            className={`${assessmentButton} min-w-0 px-1 ${key === "=" ? "bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950" : ""}`}
            onClick={() => {
              if (key === "=") {
                calculate();
                return;
              }
              if (key === "C") {
                clear();
                return;
              }
              const value =
                key === "⌫"
                  ? calculation.expression.slice(0, -1)
                  : calculation.expression + (tokens[key] ?? key);
              setExpression(value);
              input.current?.focus();
            }}
          >
            {key}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-500">
        Degrees · mod(a,b) gives the remainder · |x| is absolute value.
      </p>
      {calculation.history.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">
            Calculation history ({calculation.history.length})
          </summary>
          <div className="mt-2 space-y-1">
            {calculation.history.map((entry, index) => (
              <button
                key={index}
                onClick={() => setExpression(entry.expression)}
                className="block w-full rounded-lg border border-neutral-200 p-2 text-right text-xs dark:border-neutral-700"
              >
                {entry.expression} = {entry.result}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
export function AssessmentCalculatorTools() {
  const tools = useContext(ToolsContext);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={assessmentButton}
        onClick={() => tools?.openTool("calculator")}
      >
        <Calculator size={16} />
        Calculator
      </button>
      <button
        type="button"
        className={assessmentButton}
        onClick={() => tools?.openTool("desmos")}
      >
        <FunctionSquare size={16} />
        Desmos
      </button>
    </div>
  );
}
export function AssessmentMathPanel({ hidden = false }: { hidden?: boolean }) {
  const [tab, setTab] = useState("desmos");
  const tools = useContext(ToolsContext);
  useEffect(() => {
    if (tools?.tableRequest && !hidden) setTab("desmos");
  }, [hidden, tools?.tableRequest]);
  return (
    <section
      className="assessment-math-panel rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"
      style={{ display: hidden ? "none" : undefined }}
      data-assessment-math-panel={hidden ? "hidden" : "visible"}
      aria-label="Math tools"
    >
      <div
        className="mb-3 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Side calculator"
      >
        <button
          role="tab"
          aria-selected={tab === "desmos"}
          className={`${assessmentButton} ${tab === "desmos" ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
          onClick={() => setTab("desmos")}
        >
          <FunctionSquare size={16} />
          Desmos
        </button>
        <button
          role="tab"
          aria-selected={tab === "calculator"}
          className={`${assessmentButton} ${tab === "calculator" ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
          onClick={() => setTab("calculator")}
        >
          <Calculator size={16} />
          Calculator
        </button>
      </div>
      <div style={{ display: tab === "desmos" ? "block" : "none" }}>
        {DESMOS_API_KEY ? (
          <DesmosCalculator
            title="Desmos side calculator"
            className="h-[560px] max-h-[65dvh] w-full"
            tableRequest={tools?.tableRequest || null}
          />
        ) : (
          <iframe
            title="Desmos side calculator"
            src="https://www.desmos.com/testing/cb-sat-ap/graphing"
            className="h-[560px] max-h-[65dvh] w-full border-0"
          />
        )}
      </div>
      <div style={{ display: tab === "calculator" ? "block" : "none" }}>
        <ScientificCalculator />
      </div>
    </section>
  );
}
