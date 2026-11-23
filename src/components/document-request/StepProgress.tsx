import { Fragment } from "react";

interface StepProgressProps {
  currentStep: number;
  /** Furthest step reached; steps up to here stay clickable. */
  furthestStep?: number;
  onStepClick: (step: number) => void;
}

const steps = [
  "Method",
  "Documents",
  "Details"
];

export default function StepProgress({
  currentStep,
  furthestStep = currentStep,
  onStepClick,
}: StepProgressProps) {
  const reachable = Math.max(currentStep, furthestStep);

  return (
    <nav
      className="rwx-stepper"
      aria-label="Document request steps"
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCurrent = stepNumber === currentStep;
        const isVisited =
          stepNumber > currentStep && stepNumber <= reachable;
        const isCompleted = stepNumber < currentStep || isVisited;

        return (
          <Fragment key={step}>
            {index > 0 && (
              <span
                className={`rwx-step-line ${stepNumber <= reachable ? "is-filled" : ""}`}
                aria-hidden="true"
              />
            )}

            <button
              type="button"
              className={`rwx-step ${isCurrent ? "is-current" : ""} ${isCompleted ? "is-complete" : ""} ${isVisited ? "is-visited" : ""}`}
              onClick={() => {
                if (stepNumber <= reachable) {
                  onStepClick(stepNumber);
                }
              }}
              disabled={stepNumber > reachable}
              title={isVisited ? `Return to ${step}` : undefined}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="rwx-step-number">
                {isCompleted
                  ? "✓"
                  : String(stepNumber).padStart(2, "0")}
              </span>

              <span className="rwx-step-label">{step}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
