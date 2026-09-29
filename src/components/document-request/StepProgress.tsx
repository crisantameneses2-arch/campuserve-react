interface StepProgressProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

const steps = [
  "Method",
  "Documents",
  "Details",
  "Schedule",
];

export default function StepProgress({
  currentStep,
  onStepClick,
}: StepProgressProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <button
              key={step}
              type="button"
              onClick={() => {
                if (stepNumber <= currentStep) {
                  onStepClick(stepNumber);
                }
              }}
              disabled={stepNumber > currentStep}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                cursor:
                  stepNumber <= currentStep
                    ? "pointer"
                    : "not-allowed",
                opacity: stepNumber > currentStep ? 0.5 : 1,
                fontWeight:
                  isCurrent || isCompleted ? 600 : 400,
              }}
            >
              {stepNumber}. {step}
            </button>
          );
        })}
      </div>
    </div>
  );
}