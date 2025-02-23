import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Image, Code, Mic, Send, StopCircle, X } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendMessage = async (type: 'text' | 'image' | 'voice' | 'code', content: string, metadata?: any) => {
    if (!content.trim() && type === 'text') return;

    try {
      const messageData = {
        type,
        content,
        conversationId,
        metadata: metadata || {}
      };

      const res = await apiRequest('POST', '/api/messages', messageData);
      if (!res.ok) throw new Error('Failed to send message');
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: 'File too large',
        description: 'Please select an image under 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSendMessage('image', reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: 'Error uploading image',
        description: 'Failed to process the image',
        variant: 'destructive',
      });
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
        stream.getTracks().forEach(track => track.stop());
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage('text', message);
    }
  };

  return (
    <Card className="p-4 border-t">
      {showCodeEditor ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Code Editor</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCodeEditor(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CodeEditor
            onSubmit={(code, language) => {
              handleSendMessage('code', code, { language });
              setShowCodeEditor(false);
            }}
            onCancel={() => setShowCodeEditor(false)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            className="min-h-[100px] resize-none"
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
                title="Send image"
              >
                <Image className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCodeEditor(true)}
                title="Send code"
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                className={isRecording ? 'animate-pulse' : ''}
                title={isRecording ? 'Stop recording' : 'Start recording'}
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
              className="px-4"
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