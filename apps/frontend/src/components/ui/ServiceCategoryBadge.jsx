/** Badge suave por servicio (color desde API). */
export default function ServiceCategoryBadge({ category, className = "" }) {
  if (!category?.name) return null;

  const color = category.color ?? "#94a3b8";

  return (
    <span
      className={`service-category-badge ${className}`.trim()}
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}18`,
        color
      }}
      title={`Servicio: ${category.name}`}
    >
      {category.name}
    </span>
  );
}
