import { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CodeEditorProps = {
  onSubmit: (code: string, language: string) => void;
  onCancel: () => void;
};

const languages = {
  javascript: { extension: javascript(), name: 'JavaScript' },
  python: { extension: python(), name: 'Python' },
};

export function CodeEditor({ onSubmit, onCancel }: CodeEditorProps) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Code Editor</span>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(languages).map(([key, { name }]) => (
                <SelectItem key={key} value={key}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CodeMirror
          value={code}
          height="200px"
          extensions={[languages[language as keyof typeof languages].extension]}
          onChange={setCode}
          theme="light"
          className="border rounded-md"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSubmit(code, language)}>Send Code</Button>
        </div>
      </CardContent>
    </Card>
  );
}
