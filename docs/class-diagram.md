# Class Diagram: SMB Chatbot Core Domain

แผนภาพนี้แสดง class ของข้อมูลหลักจาก `migrations/001_initial.sql` และความสัมพันธ์ที่ฐานข้อมูลบังคับใช้จริง โดยใช้ชนิดข้อมูลเชิงโดเมนเพื่อสื่อความหมายมากกว่าชนิดจัดเก็บของ SQLite

```mermaid
classDiagram
    direction LR

    class User {
        +String id
        +Email email
        +String name
        -PasswordHash passwordHash
        +DateTime createdAt
    }

    class Shop {
        +String id
        +String name
        +String description
        +String openingHours
        +String persona
        +DateTime createdAt
        +DateTime updatedAt
    }

    class ShopMembership {
        +String shopId
        +String userId
        +MembershipRole role
        +DateTime createdAt
    }

    class Session {
        -Sha256Hash tokenHash
        +String userId
        +DateTime expiresAt
        +DateTime createdAt
    }

    class KnowledgeEntry {
        +String id
        +String shopId
        +KnowledgeKind kind
        +String title
        +String content
        +KnowledgeStatus status
        +String createdBy
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Conversation {
        +String id
        +String shopId
        +Channel channel
        +String customerExternalId
        +String customerName
        +ConversationStatus status
        +BotMode botMode
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Message {
        +String id
        +String shopId
        +String conversationId
        +MessageRole role
        +String content
        +String authorUserId
        +DateTime createdAt
    }

    class MembershipRole {
        <<enumeration>>
        owner
        agent
    }

    class KnowledgeKind {
        <<enumeration>>
        faq
        product
        policy
        general
    }

    class KnowledgeStatus {
        <<enumeration>>
        draft
        published
    }

    class Channel {
        <<enumeration>>
        web
        line
    }

    class ConversationStatus {
        <<enumeration>>
        open
        closed
    }

    class BotMode {
        <<enumeration>>
        active
        paused
        human
    }

    class MessageRole {
        <<enumeration>>
        customer
        assistant
        agent
        system
    }

    User "1" --> "0..*" Session : authenticates with
    User "1" --> "0..*" ShopMembership : joins through
    Shop "1" --> "0..*" ShopMembership : has
    Shop "1" --> "0..*" KnowledgeEntry : owns
    ShopMembership "1" --> "0..*" KnowledgeEntry : creates
    Shop "1" --> "0..*" Conversation : owns
    Conversation "1" *-- "0..*" Message : contains
    Shop "1" --> "0..*" Message : tenant scope
    ShopMembership "0..1" --> "0..*" Message : authors as agent

    ShopMembership --> MembershipRole
    KnowledgeEntry --> KnowledgeKind
    KnowledgeEntry --> KnowledgeStatus
    Conversation --> Channel
    Conversation --> ConversationStatus
    Conversation --> BotMode
    Message --> MessageRole
```

## การเทียบชนิดข้อมูลกับ SQLite

| ชนิดในแผนภาพ | ชนิดใน SQLite | กฎที่สำคัญ |
|---|---|---|
| `String` / `Email` | `TEXT` | กำหนดความยาวตาม API และห้าม identifier ว่าง |
| `PasswordHash` | `TEXT` | เก็บค่า scrypt ที่เข้ารหัสรูปแบบแล้ว ไม่เก็บรหัสผ่านจริง |
| `Sha256Hash` | `TEXT` | ตัวอักษร hexadecimal พิมพ์เล็กจำนวน 64 ตัว |
| `DateTime` | `TEXT` | ISO 8601 UTC แบบ `YYYY-MM-DDTHH:mm:ss.sssZ`; รูปแบบนี้เรียงเวลาได้ถูกต้องด้วยข้อความ |
| Enumeration | `TEXT` | ใช้ `CHECK (... IN (...))` จำกัดค่าที่อนุญาต |

SQLite `STRICT` รองรับชนิดหลักเพียง `INTEGER`, `REAL`, `TEXT`, `BLOB` และ `ANY` จึงไม่ใช้ `VARCHAR`, `ENUM` หรือ `DATETIME` ใน migration โดยตรง ส่วน `CHECK` constraints ทำหน้าที่กำหนด semantic type เพิ่มเติม

`Message.authorUserId` เป็น nullable และต้องมีค่าเฉพาะเมื่อ `role = agent` เท่านั้น หากมีค่าจะต้องอ้างถึงสมาชิกของร้านเดียวกับข้อความ ความสัมพันธ์ระหว่าง `ShopMembership` กับ `KnowledgeEntry` และ `Message` จึงใช้ composite foreign key `(shop_id, user_id)` เพื่อป้องกันการอ้างผู้ใช้ข้ามร้าน
