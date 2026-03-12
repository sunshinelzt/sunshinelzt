import asyncio
import os
import json
from telethon import TelegramClient, functions, types

CONFIG_FILE = "config.json"

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return None

def save_config(api_id, api_hash):
    with open(CONFIG_FILE, "w") as f:
        json.dump({"api_id": api_id, "api_hash": api_hash}, f)

def get_credentials():
    config = load_config()
    if config:
        print(f"нашёл сохранённые данные (api_id: {config['api_id']})")
        use_saved = input("использовать? (y/n): ").strip().lower()
        if use_saved == "y":
            return config["api_id"], config["api_hash"]

    api_id = int(input("введи api_id: "))
    api_hash = input("введи api_hash: ").strip()
    save_config(api_id, api_hash)
    print("сохранил")
    return api_id, api_hash

# подарки которые есть, потом можно добавить ещё
gifts = {
    "new_year": {
        "name": "новый год",
        "list": [
            {"id": 5922558454332916696, "emoji": "🎄", "name": "елка", "price": 50},
            {"id": 5956217000635139069, "emoji": "🧸", "name": "мишка новогодний", "price": 50},
        ]
    },
    "feb14": {
        "name": "14 февраля",
        "list": [
            {"id": 5800655655995968830, "emoji": "🧸", "name": "мишка 14 фев", "price": 50},
            {"id": 5801108895304779062, "emoji": "💘", "name": "сердечко", "price": 50},
        ]
    },
    "march8": {
        "name": "8 марта",
        "list": [
            {"id": 5866352046986232958, "emoji": "🧸", "name": "мишка 8 марта", "price": 50},
        ]
    }
}

async def main():
    api_id, api_hash = get_credentials()

    client = TelegramClient('stars_session', api_id, api_hash)
    await client.start()
    print("зашли ок")

    # выбор категории
    keys = list(gifts.keys())
    print("\nкатегории:")
    for i, k in enumerate(keys, 1):
        print(f"  {i}) {gifts[k]['name']}")
    print(f"  {len(keys)+1}) ввести айди вручную")

    ci = int(input("выбери категорию: ")) - 1

    if ci == len(keys):
        # ввод вручную
        gift_id = int(input("айди подарка: "))
        gift_name = input("название (для себя): ").strip() or "новый подарок"
        gift_emoji = input("эмодзи (или enter): ").strip() or "🎁"
        gift = {"id": gift_id, "emoji": gift_emoji, "name": gift_name}
    else:
        cat = gifts[keys[ci]]

        # выбор подарка
        print(f"\nподарки ({cat['name']}):")
        for i, g in enumerate(cat['list'], 1):
            print(f"  {i}) {g['emoji']} {g['name']} - {g['price']} stars")

        gi = int(input("выбери подарок: ")) - 1
        gift = cat['list'][gi]

    # кому слать
    uid = int(input("айди получателя: "))

    # текст к подарку (можно оставить пустым)
    msg = input("текст к подарку (или enter чтобы без текста): ").strip()

    print(f"\nотправляю {gift['name']} -> {uid}...")

    try:
        receiver = await client.get_input_entity(uid)

        invoice = types.InputInvoiceStarGift(
            user_id=receiver,
            gift_id=gift['id'],
            message=types.TextWithEntities(text=msg, entities=[])
        )

        form = await client(functions.payments.GetPaymentFormRequest(invoice=invoice))

        await client(functions.payments.SendStarsFormRequest(
            form_id=form.form_id,
            invoice=invoice
        ))

        print(f"готово {gift['emoji']}")

    except Exception as e:
        print(f"что-то пошло не так: {e}")

    await client.disconnect()

asyncio.run(main())
