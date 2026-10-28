import React from "react";

interface BreadcrumbProps {
  path: string[];
  onNavigate: (index: number) => void;
  disabled: boolean;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  path,
  onNavigate,
  disabled,
}) => {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        color: "#9ca3af",
      }}
    >
      {path.map((segment, index) => {
        const isLast = index === path.length - 1;

        return (
          <React.Fragment key={`${segment}-${index}`}>
            {index > 0 && <span style={{ color: "#4b5563" }}>›</span>}
            {isLast ? (
              <span style={{ color: "#f3f4f6", fontWeight: 600 }}>{segment}</span>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onNavigate(index)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "2px 4px",
                  color: disabled ? "#4b5563" : "#60a5fa",
                  cursor: disabled ? "default" : "pointer",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                {segment}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
