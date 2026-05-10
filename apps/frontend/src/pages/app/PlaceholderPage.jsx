import Card from "../../components/ui/Card";

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="stack-lg max-w-3xl">
      <Card variant="surface" title={title} subtitle={description}>
        <p className="text-app-muted text-sm">
          Contenido en construcción. El shell de la plataforma ya está listo para integrar
          módulos.
        </p>
      </Card>
    </div>
  );
}
