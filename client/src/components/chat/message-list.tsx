import { useQuery } from '@tanstack/react-query';
import { Message, MessageType, User } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

type MessageListProps = {
  users: User[];
  conversationId: number;
};

export function MessageList({ users, conversationId }: MessageListProps) {
  const { data: messages } = useQuery<Message[]>({
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
        return (
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code>{message.content}</code>
            <div className="text-xs text-muted-foreground mt-2">
              Language: {message.metadata?.language || 'text'}
            </div>
          </pre>
        );
      default:
        return null;
    }
  };

  const getSender = (senderId: number) =>
    users.find((u) => u.id === senderId)?.username || 'Unknown';

  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
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
            <Card
              className={`max-w-[70%] ${
                message.senderId === currentUser?.id
                  ? 'bg-primary text-primary-foreground'
                  : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{getSender(message.senderId)}</span>
                  <span className="text-xs opacity-70">
                    {format(message.timestamp ? new Date(message.timestamp) : new Date(), 'HH:mm')}
                  </span>
                </div>
                {renderMessageContent(message)}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}