import asyncio
from typing import List

class EventBroadcaster:
    def __init__(self):
        self.subscribers: List[asyncio.Queue] = []

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self.subscribers:
            self.subscribers.remove(queue)

    async def broadcast(self, message: str):
        for queue in self.subscribers:
            await queue.put(message)

# Global instance
broadcaster = EventBroadcaster()
