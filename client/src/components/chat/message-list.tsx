import { useQuery } from '@tanstack/react-query';
import { Message, MessageType, User } from '@shared/schema';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    }
  });

  const { user: currentUser } = useAuth();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMessageContent = (message: Message) => {
    switch (message.type as MessageType) {
      case 'text':
        return (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        );
      case 'image':
        return message.content ? (
          <div className="relative group">
            <img
              src={message.content}
              alt="Shared image"
              className="max-w-sm rounded-lg transition-transform transform hover:scale-[1.02]"
              loading="lazy"
            />
          </div>
        ) : null;
      case 'voice':
        return message.content ? (
          <div className="w-full max-w-sm bg-card/50 rounded-lg p-2">
            <audio controls className="w-full">
              <source src={message.content} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
          </div>
        ) : null;
      case 'code':
        const language = (message.metadata?.language || 'text') as keyof typeof languageExtensions;
        return (
          <div className="space-y-2 w-full max-w-2xl">
            <div className="bg-card/50 rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-xs font-mono flex items-center justify-between">
                <span>{message.metadata?.language || 'text'}</span>
              </div>
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
                className="text-sm"
              />
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full px-6">
        <div className="space-y-6 py-6">
          {messages?.map((message, index) => {
            const isCurrentUser = message.senderId === currentUser?.id;
            const showAvatar = !isCurrentUser && (!messages[index - 1] || messages[index - 1].senderId !== message.senderId);

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  isCurrentUser ? 'justify-end' : 'justify-start'
                } animate-in slide-in-from-bottom-2 fade-in duration-200`}
              >
                {showAvatar && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getSender(message.senderId).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                {!showAvatar && !isCurrentUser && <div className="w-8" />}
                <div
                  className={`group relative max-w-[85%] ${
                    isCurrentUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                      isCurrentUser
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted/80 rounded-bl-sm'
                    }`}
                  >
                    {!isCurrentUser && (
                      <div className="mb-1 text-sm font-medium">
                        {getSender(message.senderId)}
                      </div>
                    )}
                    {renderMessageContent(message)}
                  </div>
                  <div
                    className={`text-xs text-muted-foreground mt-1 ${
                      isCurrentUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {format(new Date(message.timestamp), 'HH:mm')}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}