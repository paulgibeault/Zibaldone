
from sqlmodel import Session, select, desc
from app.models import engine, ProcessingTask

def check_tasks():
    with Session(engine) as session:
        statement = select(ProcessingTask).order_by(desc(ProcessingTask.start_time)).limit(10)
        results = session.exec(statement).all()
        print(f"Top 10 recent tasks:")
        for task in results:
            print(f"Task ID: {task.id}, Status: {task.status}, Name: {task.name}, Item ID: {task.item_id}, Start Time: {task.start_time}, End Time: {task.end_time}, Msg: {task.message}")

if __name__ == "__main__":
    check_tasks()
