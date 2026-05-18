import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface OnboardingStepContentProps {
  title: string;
  description: string;
  checklist: string[];
}

export const OnboardingStepContent = ({
  title,
  description,
  checklist,
}: OnboardingStepContentProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2">
        {checklist.map((item) => (
          <li key={item} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);
