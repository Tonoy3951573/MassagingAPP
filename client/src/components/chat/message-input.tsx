import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Image, Code, Mic, Send, StopCircle } from 'lucide-react';
import { CodeEditor } from './code-editor';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

type MessageInputProps = {
  onMessageSent: () => void;
  conversationId: number;
};

export function MessageInput({ onMessageSent, conversationId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async (type: 'text' | 'image' | 'voice' | 'code', content: string, metadata?: any) => {
    if (!content.trim() && type === 'text') return;

    try {
      const res = await apiRequest('POST', '/api/messages', {
        type,
        content,
        conversationId,
        metadata,
      });

      await res.json();
      setMessage('');
      onMessageSent();
    } catch (error) {
      toast({
        title: 'Error sending message',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSendMessage('image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = () => {
          handleSendMessage('voice', reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: 'Error recording audio',
        description: 'Please make sure you have given microphone permissions',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <Card className="p-4">
      {showCodeEditor ? (
        <CodeEditor
          onSubmit={(code, language) => {
            handleSendMessage('code', code, { language });
            setShowCodeEditor(false);
          }}
          onCancel={() => setShowCodeEditor(false)}
        />
      ) : (
        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[100px]"
          />
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCodeEditor(true)}
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <StopCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              onClick={() => handleSendMessage('text', message)}
              disabled={!message.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}