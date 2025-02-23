import { useQuery } from '@tanstack/react-query';
import { Message, MessageType, User } from '@shared/schema';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { useEffect, useRef } from 'react';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    }
  });

  const { user: currentUser } = useAuth();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const renderMessageContent = (message: Message) => {
    switch (message.type as MessageType) {
      case 'text':
        return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
      case 'image':
        return message.content ? (
          <img
            src={message.content}
            alt="Shared image"
            className="max-w-sm rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            loading="lazy"
          />
        ) : null;
      case 'voice':
        return message.content ? (
          <audio controls className="w-full max-w-sm">
            <source src={message.content} type="audio/wav" />
          </audio>
        ) : null;
      case 'code':
        const language = (message.metadata?.language || 'text') as keyof typeof languageExtensions;
        return (
          <div className="space-y-2 w-full max-w-2xl">
            <CodeMirror
              value={message.content || ''}
              height="auto"
              minHeight="50px"
              maxHeight="400px"
              readOnly
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: false,
                foldGutter: false,
              }}
              theme="light"
              extensions={[languageExtensions[language]]}
              className="border rounded-md overflow-hidden text-sm"
            />
            <div className="text-xs text-muted-foreground">
              Language: {message.metadata?.language || 'text'}
            </div>
          </div>
        );
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
    <ScrollArea 
      ref={scrollRef}
      className="h-[calc(100vh-300px)] bg-gradient-to-b from-background to-muted relative"
    >
      <div className="space-y-6 p-6">
        {messages?.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${
              message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'
            } animate-in fade-in-0 slide-in-from-bottom-1`}
          >
            {message.senderId !== currentUser?.id && (
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">
                  {getSender(message.senderId).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={`max-w-[80%] rounded-lg p-4 shadow-sm ${
                message.senderId === currentUser?.id
                  ? 'bg-primary text-primary-foreground rounded-br-none'
                  : 'bg-card rounded-bl-none'
              }`}
            >
              <div className="flex justify-between items-center gap-4 mb-2">
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