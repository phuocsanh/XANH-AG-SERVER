package main

import "fmt"

func main() {

	a := 10  /* Khai báo các biến thực tế */
	ip := &a /* Địa chỉ lưu trữ của con trỏ */

	fmt.Printf("a Địa chỉ của biến là: %x\n", &a)

	/* Địa chỉ lưu trữ của con trỏ */
	fmt.Printf("ip Con trỏ địa chỉ được lưu trong biến: %x\n", ip)
	fmt.Printf("ip Con trỏ địa chỉ được lưu trong biến11: %x\n", &ip)

	/* Truy cập giá trị bằng con trỏ */
	fmt.Printf("*ip gia trị: %d\n", *ip)
}
