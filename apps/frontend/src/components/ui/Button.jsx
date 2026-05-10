const variantClasses = {
  primary: "btn btn-primary",
  ghost: "btn btn-ghost",
  "ghost-surface": "btn btn-ghost-surface"
};

export default function Button({ children, variant = "primary", ...props }) {
  const variantClass = variantClasses[variant] ?? variantClasses.primary;
  return (
    <button className={variantClass} {...props}>
      {children}
    </button>
  );
}
