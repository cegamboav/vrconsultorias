export default function Button({ children, variant = "primary", ...props }) {
  const variantClass = variant === "ghost" ? "btn btn-ghost" : "btn btn-primary";
  return (
    <button className={variantClass} {...props}>
      {children}
    </button>
  );
}
