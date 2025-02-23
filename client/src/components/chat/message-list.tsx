import { useQuery } from '@tanstack/react-query';
import { Message, MessageType, User } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';

type MessageListProps = {
  users: User[];
  conversationId: number;
};

const languageExtensions = {
  javascript: javascript(),
  python: python(),
  text: [],
};

export function MessageList({ users, conversationId }: MessageListProps) {
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    }
  });

  const { user: currentUser } = useAuth();

  const renderMessageContent = (message: Message) => {
    switch (message.type as MessageType) {
      case 'text':
        return <p className="whitespace-pre-wrap">{message.content}</p>;
      case 'image':
        return message.content ? (
          <img
            src={message.content}
            alt="Shared image"
            className="max-w-sm rounded-lg"
          />
        ) : null;
      case 'voice':
        return message.content ? (
          <audio controls className="w-full max-w-sm">
            <source src={message.content} type="audio/wav" />
          </audio>
        ) : null;
      case 'code':
        try {
          const language = (message.metadata?.language || 'text') as keyof typeof languageExtensions;
          console.log('Rendering code message:', { content: message.content, language, metadata: message.metadata });

          return (
            <div className="space-y-2">
              <CodeMirror
                value={message.content || ''}
                height="200px"
                readOnly
                theme="light"
                extensions={[languageExtensions[language]]}
                className="border rounded-md"
              />
              <div className="text-xs text-muted-foreground">
                Language: {message.metadata?.language || 'text'}
              </div>
            </div>
          );
        } catch (error) {
          console.error('Error rendering code message:', error);
          return (
            <div className="space-y-2">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{message.content}</code>
              </pre>
              <div className="text-xs text-muted-foreground">
                Failed to render with syntax highlighting
              </div>
            </div>
          );
        }
      default:
        return null;
    }
  };

  const getSender = (senderId: number) =>
    users.find((u) => u.id === senderId)?.username || 'Unknown';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-300px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-300px)] bg-gradient-to-b from-background to-muted">
      <div className="space-y-4 p-4">
        {messages?.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${
              message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.senderId !== currentUser?.id && (
              <Avatar>
                <AvatarFallback>
                  {getSender(message.senderId).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={`max-w-[70%] rounded-lg p-4 ${
                message.senderId === currentUser?.id
                  ? 'bg-primary text-primary-foreground rounded-br-none'
                  : 'bg-card rounded-bl-none'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">
                  {getSender(message.senderId)}
                </span>
                <span className="text-xs opacity-70">
                  {format(new Date(message.timestamp), 'HH:mm')}
                </span>
              </div>
              {renderMessageContent(message)}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}